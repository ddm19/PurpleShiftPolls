// Supabase-backed data store for Purple Shift survey.
// Tables: questions, level_options, responses.
// Storage bucket: level-images (public).
// See supabase.md for the SQL schema.

import { supabase, LEVELS_BUCKET } from "./supabase";

export type QuestionType = "text" | "multiple_choice" | "level_gallery";

export interface LevelOption {
  id: string;
  question_id: string;
  title: string;
  image_url: string;
  // storage path inside the bucket — used for deletion
  image_path?: string | null;
}

export interface Question {
  id: string;
  type: QuestionType;
  text_prompt: string;
  order: number;
  choices?: string[];
}

export interface Response {
  id: string;
  question_id: string;
  answer: string;
  created_at: string;
}

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`);

// ---------- Questions ----------

export async function getQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("id, type, text_prompt, order, choices")
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
    choices: q.type === "multiple_choice" ? (q.choices ?? []) : null,
  };
  const { error } = await supabase.from("questions").upsert(payload);
  if (error) throw error;
}

export async function deleteQuestion(id: string): Promise<void> {
  // best-effort cleanup of storage files for this question's options
  const opts = await getOptionsForQuestion(id);
  const paths = opts.map((o) => o.image_path).filter(Boolean) as string[];
  if (paths.length > 0) {
    await supabase.storage.from(LEVELS_BUCKET).remove(paths);
  }
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) throw error;
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

/**
 * Upload a single image to the storage bucket and return its public URL +
 * the storage path (used later for deletion).
 */
export async function uploadLevelImage(
  questionId: string,
  file: File,
): Promise<{ image_url: string; image_path: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${questionId}/${uid()}.${ext}`;
  const { error } = await supabase.storage
    .from(LEVELS_BUCKET)
    .upload(path, file, {
      contentType: file.type || `image/${ext}`,
      upsert: false,
    });
  if (error) throw error;
  const { data } = supabase.storage.from(LEVELS_BUCKET).getPublicUrl(path);
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
  if (rs.length === 0) return;
  const { error } = await supabase.from("responses").insert(
    rs.map((r) => ({ question_id: r.question_id, answer: r.answer })),
  );
  if (error) throw error;
}
