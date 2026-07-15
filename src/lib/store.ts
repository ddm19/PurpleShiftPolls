import { supabase, LEVELS_BUCKET } from "./supabase";

export type QuestionType = "text" | "numeric" | "multiple_choice" | "level_gallery" | "slider";

export interface LevelOption {
  id: string;
  question_id: string;
  title: string;
  image_url: string;
  image_path?: string | null;
}

export interface Question {
  id: string;
  type: QuestionType;
  text_prompt: string;
  order: number;
  choices?: string[];
  is_optional?: boolean;
  image_urls?: string[];
  image_paths?: string[];
  // for slider
  slider_min?: number;
  slider_max?: number;
  slider_left_label?: string;
  slider_right_label?: string;
}

export interface Response {
  id: string;
  question_id: string;
  answer: string | null;
  created_at: string;
}

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`);

// ---------- Questions ----------

export async function getQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("id, type, text_prompt, order, choices, is_optional, image_urls, image_paths, slider_min, slider_max, slider_left_label, slider_right_label")
    .order("order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Question[];
}

export async function upsertQuestion(q: Question): Promise<void> {
  const payload = {
    id: q.id,
    type: q.type,
    text_prompt: q.text_prompt,
    order: q.order,
    choices: q.type === "multiple_choice" ? q.choices ?? [] : null,
    is_optional: q.is_optional,
    image_urls: q.image_urls,
    image_paths: q.image_paths,
    slider_min: q.slider_min,
    slider_max: q.slider_max,
    slider_left_label: q.slider_left_label,
    slider_right_label: q.slider_right_label,
  };
  const { error } = await supabase.from("questions").upsert(payload);
  if (error) throw error;
}

export async function deleteQuestion(id: string): Promise<void> {
  const opts = await getOptionsForQuestion(id);
  const levelImagePaths = opts.map((o) => o.image_path).filter(Boolean) as string[];

  if (levelImagePaths.length > 0) {
    await supabase.storage.from(LEVELS_BUCKET).remove(levelImagePaths);
  }

  const { data: qData } = await supabase
    .from("questions")
    .select("image_paths")
    .eq("id", id)
    .single();

  const paths = (qData?.image_paths ?? []).filter(Boolean);

  if (paths.length > 0) {
    await supabase.storage.from("question_images").remove(paths);
  }

  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Construye una nueva ruta para un objeto de Storage copiado.
 * Prefija la ruta con el ID de la nueva pregunta para mantener la organización y evitar colisiones.
 * @param oldPath - La ruta original del archivo.
 * @param newOwnerId - El ID del nuevo propietario del archivo (ej. newQuestionId).
 * @returns La nueva ruta para el objeto en Storage.
 */
function buildNewPath(oldPath: string, newOwnerId: string): string {
  const fileName = oldPath.split('/').pop() || 'unknown_file';
  // newOwnerId/copy-random-originalName.ext
  return `${newOwnerId}/copy-${uid()}-${fileName}`;
}

/**
 * Copia un objeto en Supabase Storage y devuelve su nueva ruta y URL pública.
 * @throws Un error descriptivo si la copia falla, sugiriendo problemas de RLS.
 */
async function copyStorageObject(
  bucket: string,
  oldPath: string,
  newPath: string,
): Promise<{ newPath: string; publicUrl: string }> {
  const { error: copyError } = await supabase.storage.from(bucket).copy(oldPath, newPath);

  if (copyError) {
    throw new Error(
      `Error al copiar la imagen en Storage (de '${oldPath}' a '${newPath}' en el bucket '${bucket}').\n` +
      `Causa probable: Políticas de Row Level Security (RLS) en el bucket.\n` +
      `Asegúrate de que la política de INSERT permite la operación 'copy' para usuarios autenticados.\n` +
      `Si no es posible, esta operación debe realizarse desde una Edge Function con 'service_role'.\n` +
      `Error original: ${copyError.message}`,
    );
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(newPath);
  return { newPath, publicUrl: urlData.publicUrl };
}

export async function duplicateQuestion(originalQuestionId: string): Promise<Question> {
  // 1. Obtener la pregunta original y sus opciones de nivel.
  const { data: original, error: qError } = await supabase
    .from("questions")
    .select("*")
    .eq("id", originalQuestionId)
    .single();

  if (qError || !original) throw qError ?? new Error("Question not found");

  const originalOptions = original.type === 'level_gallery'
    ? await getOptionsForQuestion(originalQuestionId)
    : [];

  // 2. Crear la nueva pregunta en la base de datos.
  const { id: _id, created_at: _createdAt, order: _order, ...restOfQuestion } = original;
  const newQuestionPayload = {
    ...restOfQuestion,
    text_prompt: `${original.text_prompt} (Copia)`,
  };

  const { data: newQuestion, error: insertError } = await supabase
    .from('questions')
    .insert(newQuestionPayload)
    .select()
    .single();

  if (insertError || !newQuestion) throw insertError ?? new Error("Failed to create new question.");

  // 3. Duplicar imágenes adjuntas a la pregunta.
  if (original.image_paths?.length > 0) {
    const copiedImages = await Promise.all(
      original.image_paths.map(p => copyStorageObject('question_images', p, buildNewPath(p, newQuestion.id)))
    );
    await supabase.from('questions').update({
      image_paths: copiedImages.map(img => img.newPath),
      image_urls: copiedImages.map(img => img.publicUrl),
    }).eq('id', newQuestion.id);
  }

  // 4. Duplicar opciones de nivel y sus imágenes.
  if (originalOptions.length > 0) {
    const newOptionsPayload = await Promise.all(originalOptions.map(async (opt) => {
      const { id: _optId, question_id: _qId, created_at: _optCreatedAt, ...restOfOption } = opt;
      let newImagePath = null;
      let newImageUrl = opt.image_url; // Mantener la URL si no hay path

      if (opt.image_path) {
        const { newPath, publicUrl } = await copyStorageObject(LEVELS_BUCKET, opt.image_path, buildNewPath(opt.image_path, newQuestion.id));
        newImagePath = newPath;
        newImageUrl = publicUrl;
      }

      return {
        ...restOfOption,
        id: uid(),
        question_id: newQuestion.id,
        image_path: newImagePath,
        image_url: newImageUrl,
      };
    }));

    const { error: optionsError } = await supabase.from('level_options').insert(newOptionsPayload);
    if (optionsError) {
      console.warn(`ADVERTENCIA: La pregunta se duplicó (ID: ${newQuestion.id}) pero falló la inserción de sus level_options. Error: ${optionsError.message}`);
    }
  }

  return newQuestion as Question;
}

export async function reorderQuestions(qs: Question[]): Promise<void> {
  // Persist new order values.
  const updates = qs.map((q, i) =>
    supabase.from("questions").update({ order: i + 1 }).eq("id", q.id),
  );
  const results = await Promise.all(updates);
  for (const r of results) if (r.error) throw r.error;
}

// ---------- Level options ----------

export async function getOptionsForQuestion(qid: string): Promise<LevelOption[]> {
  const { data, error } = await supabase
    .from("level_options")
    .select("id, question_id, title, image_url, image_path")
    .eq("question_id", qid)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LevelOption[];
}

export async function uploadQuestionImage(
  file: File,
  bucketName: string = LEVELS_BUCKET
): Promise<{ image_url: string; image_path: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${uid()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(path, file, {
      contentType: file.type || `image/${ext}`,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return { image_url: data.publicUrl, image_path: path };
}

export async function addOptions(newOpts: LevelOption[]): Promise<void> {
  if (newOpts.length === 0) return;
  const { error } = await supabase.from("level_options").insert(
    newOpts.map((o) => ({
      id: o.id,
      question_id: o.question_id,
      title: o.title,
      image_url: o.image_url,
      image_path: o.image_path ?? null,
    })),
  );
  if (error) throw error;
}

export async function updateOption(opt: LevelOption): Promise<void> {
  const { error } = await supabase
    .from("level_options")
    .update({ title: opt.title, image_url: opt.image_url })
    .eq("id", opt.id);
  if (error) throw error;
}

export async function deleteOption(id: string): Promise<void> {
  const { data, error: selErr } = await supabase
    .from("level_options")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (data?.image_path) {
    await supabase.storage.from(LEVELS_BUCKET).remove([data.image_path]);
  }
  const { error } = await supabase.from("level_options").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Responses ----------

export async function addResponses(
  rs: Omit<Response, "id" | "created_at">[],
): Promise<void> {
  if (rs.length === 0) return; // No hay respuestas para añadir
  const { error } = await supabase.from("responses").insert(
    rs.map((r) => ({ question_id: r.question_id, answer: r.answer })),
  );
  if (error) throw error;
}
