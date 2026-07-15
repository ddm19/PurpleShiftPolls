import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addOptions,
  duplicateQuestion,
  deleteQuestion,
  getOptionsForQuestion,
  getQuestions,
  reorderQuestions,
  uid,
  updateOption,
  type LevelOption,
  type Question, uploadQuestionImage,
  type QuestionType,
  upsertQuestion, deleteOption,
} from "@/lib/store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Purple Shift — Consola de Administración" },
      { name: "description", content: "Consola de administración para la encuesta de Purple Shift." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

const PASSWORD = "7777";
const AUTH_KEY = "ps_admin_auth";

function AdminPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(AUTH_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  if (!authed) return <PasswordGate onPass={() => setAuthed(true)} />;
  return (
    <AdminConsole
      onLock={() => {
        sessionStorage.removeItem(AUTH_KEY);
        setAuthed(false);
      }}
    />
  );
}

function PasswordGate({ onPass }: { onPass: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  const submit = () => {
    if (pw === PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      onPass();
    } else {
      setErr(true);
      setPw("");
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
      <div className="panel-cyber p-10 w-full max-w-md slide-in">
        <div className="text-center mb-8">
          <div className="text-[10px] tracking-[0.4em] text-muted-foreground mb-2">
            // TERMINAL SEGURO
          </div>
          <h1 className="neon-text-red text-3xl font-bold tracking-widest flicker">
            PUERTA DE ACCESO
          </h1>
        </div>
        <label className="block text-[10px] tracking-widest text-muted-foreground mb-2">
          CLAVE DE AUTENTICACIÓN
        </label>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setErr(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={`input-cyber w-full text-center text-2xl tracking-[0.5em] ${err ? "neon-border-red" : ""
            }`}
          placeholder="••••"
        />
        {err && (
          <div className="neon-text-red text-xs mt-3 tracking-widest text-center">
            ✕ ACCESO DENEGADO
          </div>
        )}
        <button onClick={submit} className="btn-neon-purple w-full py-3 mt-6">
          Autenticar
        </button>
        <div className="text-center mt-6">
          <a href="/" className="text-xs text-muted-foreground hover:neon-text-blue tracking-widest" >
            ← VOLVER A LA ENCUESTA
          </a>
        </div>
      </div>
    </div>
  );
}

function AdminConsole({ onLock }: { onLock: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editing, setEditing] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setQuestions(await getQuestions());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const newQuestion = () => {
    setEditing({
      id: uid(),
      type: "text",
      text_prompt: "",
      is_optional: false,
      order: questions.length + 1,
      slider_min: 0,
      slider_max: 10,
      slider_left_label: "",
      slider_right_label: "",
      choices: [],
    });
  };

  return (
    <div className="relative z-10 min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between border-b border-border/40">
        <div>
          <span className="neon-text-purple text-xl font-bold tracking-[0.3em]">ADMIN</span>
          <span className="neon-text-red text-xl font-bold tracking-[0.3em] ml-1">::CONSOLA</span>
        </div>
        <div className="flex gap-3">
          <a href="/" className="btn-neon-blue px-4 py-2 text-xs">Ver Encuesta</a>
          <button onClick={onLock} className="btn-neon-red px-4 py-2 text-xs">Bloquear</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold neon-text-blue tracking-widest">PREGUNTAS</h1>
          <button onClick={newQuestion} className="btn-neon-purple px-5 py-2">
            + Nueva Pregunta
          </button>
        </div>

        {error && (
          <div className="panel-cyber p-4 neon-border-red mb-4">
            <div className="neon-text-red text-xs tracking-widest mb-1">✕ ERROR</div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {editing && (
          <QuestionEditor
            question={editing}
            onSave={async (q) => {
              try {
                await upsertQuestion(q);
                setEditing(null);
                await refresh();
              } catch (e: any) {
                setError(e?.message ?? String(e));
              }
            }}
            onCancel={() => setEditing(null)}
          />
        )}

        <div className="space-y-3 mt-6">
          {questions.length === 0 && (
            <div className="text-muted-foreground text-center py-12">
              // no hay preguntas definidas. haz clic en "nueva pregunta" para empezar.
            </div>
          )}
          {questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              q={q}
              isDragged={draggedIndex === i}
              isDropTarget={dropIndex === i}
              onEdit={() => setEditing(q)}
              onDelete={async () => {
                if (confirm(`¿Borrar "${q.text_prompt}"?`)) {
                  try {
                    await deleteQuestion(q.id);
                    await refresh();
                  } catch (e: any) {
                    setError(e?.message ?? String(e));
                  }
                }
              }}
              onMove={async (dir) => {
                const idx = questions.findIndex((x) => x.id === q.id);
                const swap = idx + dir;
                if (swap < 0 || swap >= questions.length) return;
                const next = [...questions];
                [next[idx], next[swap]] = [next[swap], next[idx]];
                try {
                  await reorderQuestions(next);
                  await refresh();
                } catch (e: any) {
                  setError(e?.message ?? String(e));
                }
              }}
              onDuplicate={async () => {
                if (!confirm(`¿Duplicar "${q.text_prompt}"?`)) return;
                try {
                  const newQuestion = await duplicateQuestion(q.id);
                  const originalIndex = questions.findIndex(x => x.id === q.id);
                  const reordered = [...questions];
                  if (originalIndex !== -1) {
                    reordered.splice(originalIndex + 1, 0, newQuestion);
                  }
                  await reorderQuestions(reordered);
                  await refresh();
                } catch (e: any) {
                  setError(e?.message ?? String(e));
                }
              }}
              onDragStart={() => setDraggedIndex(i)}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDropIndex(null);
              }}
              onDragEnter={() => setDropIndex(i)}
              onDrop={async () => {
                if (draggedIndex === null || draggedIndex === i) return;
                const next = [...questions];
                const [draggedItem] = next.splice(draggedIndex, 1);
                next.splice(i, 0, draggedItem);
                try {
                  await reorderQuestions(next);
                  await refresh();
                } catch (e: any) {
                  setError(e?.message ?? String(e));
                }
                setDraggedIndex(null);
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function QuestionRow({
  q,
  onEdit,
  onDelete,
  onMove,
  onDuplicate,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
  isDragged,
  isDropTarget,
}: {
  q: Question;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  isDragged: boolean;
  isDropTarget: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`panel-cyber p-5 flex items-center gap-4 transition-all cursor-grab ${isDragged ? "opacity-30" : ""} ${isDropTarget ? "neon-border-blue" : ""}`}
    >
      <div className="text-xs text-muted-foreground w-10 select-none">
        #{String(q.order).padStart(2, "0")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] tracking-widest neon-text-blue mb-1 select-none">
          {q.type.toUpperCase().replace("_", " ")}
        </div>
        <div className="font-bold truncate">{q.text_prompt || "(sin título)"}</div>
      </div>
      <div className="flex gap-1">
        <button className="btn-neon-blue px-2 py-1 text-xs" onClick={() => onMove(-1)}>
          ↑
        </button>
        <button className="btn-neon-blue px-2 py-1 text-xs" onClick={() => onMove(1)}>
          ↓
        </button>
        <button className="btn-neon-blue px-3 py-1 text-xs" onClick={onEdit}>
          Editar
        </button>
        <button className="btn-neon-blue px-3 py-1 text-xs" onClick={onDuplicate}>
          Duplicar
        </button>
        <button className="btn-neon-red px-3 py-1 text-xs" onClick={onDelete}>
          Borrar
        </button>
      </div>
    </div>
  );
}

function QuestionEditor({
  question,
  onSave,
  onCancel,
}: {
  question: Question;
  onSave: (q: Question) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState<Question>(question);
  const [choicesText, setChoicesText] = useState((question.choices ?? []).join("\n"));

  const save = () => {
    const cleaned: Question = {
      ...q,
      choices:
        q.type === "multiple_choice"
          ? choicesText.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
    };
    onSave(cleaned);
  };

  return (
    <div className="panel-cyber p-6 neon-border-purple slide-in">
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2">
          <Label>Pregunta</Label>
          <input
            className="input-cyber w-full"
            value={q.text_prompt}
            onChange={(e) => setQ({ ...q, text_prompt: e.target.value })}
            placeholder="Introduce el texto de la pregunta..."
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="is_optional"
              checked={q.is_optional}
              onChange={(e) => setQ({ ...q, is_optional: e.target.checked })} />
            <label htmlFor="is_optional" className="text-sm text-muted-foreground select-none">Pregunta opcional (permite saltar)</label>
          </div>
        </div>
        <div>
          <Label>Tipo</Label>
          <select
            className="input-cyber w-full"
            value={q.type}
            onChange={(e) => setQ({ ...q, type: e.target.value as QuestionType })}
          >
            <option value="text">Entrada de Texto</option>
            <option value="numeric">Entrada Numérica</option>
            <option value="slider">Slider</option>
            <option value="multiple_choice">Opción Múltiple</option>
            <option value="level_gallery">Galería de Niveles</option>
          </select>
        </div>
      </div>

      {q.type === "multiple_choice" && (
        <div className="mb-4">
          <Label>Opciones (una por línea)</Label>
          <textarea
            className="input-cyber w-full font-mono"
            rows={4}
            value={choicesText}
            onChange={(e) => setChoicesText(e.target.value)}
            placeholder={"Opción A\nOpción B\nOpción C"}
          />
        </div>
      )}

      {q.type === "level_gallery" && <LevelManager questionId={q.id} />}

      {q.type === "slider" && <SliderEditor q={q} setQ={setQ} />}

      <QuestionImageManager question={q} onUpdate={setQ} />

      <div className="flex justify-end gap-3 mt-6">
        <button className="btn-neon-red px-5 py-2" onClick={onCancel}>Cancelar</button>
        <button className="btn-neon-purple px-6 py-2" onClick={save}>Guardar Pregunta</button>
      </div>
    </div>
  );
}

function SliderEditor({ q, setQ }: { q: Question, setQ: (q: Question) => void }) {
  return (
    <div className="grid md:grid-cols-4 gap-4 mb-4">
      <div>
        <Label>Mínimo</Label>
        <input
          type="number"
          className="input-cyber w-full"
          value={q.slider_min ?? 0}
          onChange={(e) => setQ({ ...q, slider_min: e.target.valueAsNumber })} />
      </div>
      <div>
        <Label>Máximo</Label>
        <input
          type="number"
          className="input-cyber w-full"
          value={q.slider_max ?? 10}
          onChange={(e) => setQ({ ...q, slider_max: e.target.valueAsNumber })} />
      </div>
      <div>
        <Label>Etiqueta Izquierda</Label>
        <input
          className="input-cyber w-full"
          value={q.slider_left_label ?? ""}
          onChange={(e) => setQ({ ...q, slider_left_label: e.target.value })} />
      </div>
      <div>
        <Label>Etiqueta Derecha</Label>
        <input
          className="input-cyber w-full"
          value={q.slider_right_label ?? ""}
          onChange={(e) => setQ({ ...q, slider_right_label: e.target.value })} />
      </div>
    </div>
  );
}

function QuestionImageManager({ question, onUpdate }: { question: Question, onUpdate: (q: Question) => void }) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr: PendingUpload[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      arr.push({
        id: uid(),
        file: f,
        title: f.name.replace(/\.[^.]+$/, ""),
        preview: URL.createObjectURL(f),
      });
    }
    setPending((p) => [...p, ...arr]);
  };

  const commit = async () => {
    setUploading(true);
    setError(null);
    try {
      const newImageUrls = [...(question.image_urls ?? [])];
      const newImagePaths = [...(question.image_paths ?? [])];

      for (const p of pending) {
        const { image_url, image_path } = await uploadQuestionImage(p.file, "question_images");
        newImageUrls.push(image_url);
        newImagePaths.push(image_path);
      }
      onUpdate({ ...question, image_urls: newImageUrls, image_paths: newImagePaths });
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (index: number) => {
    const imageUrl = question.image_urls?.[index];
    const imagePath = question.image_paths?.[index];
    if (!imageUrl || !imagePath) return;

    if (!confirm(`¿Borrar esta imagen?`)) return;

    try {
      const nextUrls = [...(question.image_urls ?? [])];
      const nextPaths = [...(question.image_paths ?? [])];
      nextUrls.splice(index, 1);
      nextPaths.splice(index, 1);
      onUpdate({ ...question, image_urls: nextUrls, image_paths: nextPaths });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <div className="mt-6">
      <Label>Adjuntar Imágenes a la Pregunta</Label>
      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed p-6 text-center cursor-pointer transition-all border-border hover:border-primary/60"
      >
        <div className="neon-text-purple text-2xl mb-2">⬆</div>
        <div className="tracking-widest text-xs">SUELTA IMÁGENES O HAZ CLIC PARA SUBIR</div>
        <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {error && <div className="neon-text-red text-xs mt-2 tracking-widest">✕ {error}</div>}

      {pending.length > 0 && (
        <div className="mt-4 panel-cyber p-4">
          <div className="text-[10px] tracking-widest neon-text-blue mb-3">
            SUBIDA PENDIENTE · {pending.length}
          </div>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <img src={p.preview} alt="" className="block h-10 w-10 object-cover" />
                <span className="text-sm text-muted-foreground truncate">{p.file.name}</span>
                <button
                  className="btn-neon-red px-3 py-1 text-xs ml-auto"
                  onClick={() => {
                    URL.revokeObjectURL(p.preview);
                    setPending(pending.filter((x) => x.id !== p.id));
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button onClick={commit} disabled={uploading} className="btn-neon-purple px-5 py-2 mt-4">
            {uploading ? "Subiendo..." : `Adjuntar ${pending.length} Imagen${pending.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {(question.image_urls?.length ?? 0) > 0 && (
        <div className="mt-4">
          <Label>Imágenes Actuales</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {question.image_urls?.map((url, i) => (
              <div key={url} className="relative group">
                <img src={url} className="w-full h-24 object-cover" />
                <button
                  onClick={() => deleteImage(i)}
                  className="absolute top-1 right-1 bg-red-800/80 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] tracking-widest text-muted-foreground mb-1">
      {children}
    </label>
  );
}

interface PendingUpload {
  id: string;
  file: File;
  title: string;
  preview: string;
}

function LevelManager({ questionId }: { questionId: string }) {
  const [opts, setOpts] = useState<LevelOption[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setOpts(await getOptionsForQuestion(questionId));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [questionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr: PendingUpload[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      arr.push({
        id: uid(),
        file: f,
        title: f.name.replace(/\.[^.]+$/, ""),
        preview: URL.createObjectURL(f),
      });
    }
    setPending((p) => [...p, ...arr]);
  };

  const commit = async () => {
    setUploading(true);
    setError(null);
    try {
      const uploaded: LevelOption[] = [];
      for (const p of pending) {
        const { image_url, image_path } = await uploadQuestionImage(p.file);
        uploaded.push({
          id: uid(),
          question_id: questionId,
          title: p.title,
          image_url,
          image_path,
        });
      }
      await addOptions(uploaded);
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-2">
      <Label>Imágenes de Nivel</Label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed p-8 text-center cursor-pointer transition-all ${dragging
          ? "neon-border-purple bg-primary/5"
          : "border-border hover:border-primary/60"
          }`}
      >
        <div className="neon-text-purple text-3xl mb-2">⬆</div>
        <div className="tracking-widest text-sm">SUELTA IMÁGENES O HAZ CLIC PARA SUBIR</div>
        <div className="text-xs text-muted-foreground mt-1">se admiten múltiples archivos</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <div className="neon-text-red text-xs mt-2 tracking-widest">✕ {error}</div>}

      {pending.length > 0 && (
        <div className="mt-4 panel-cyber p-4">
          <div className="text-[10px] tracking-widest neon-text-blue mb-3">
            SUBIDA PENDIENTE · {pending.length}
          </div>
          <div className="space-y-2">
            {pending.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-14 flex justify-center">
                  <img src={p.preview} alt="" className="block max-h-14 max-w-14 w-auto h-auto" />
                </div>
                <input
                  className="input-cyber flex-1"
                  value={p.title}
                  onChange={(e) => {
                    const next = [...pending];
                    next[i] = { ...p, title: e.target.value };
                    setPending(next);
                  }}
                  placeholder="Título del nivel..."
                />
                <button
                  className="btn-neon-red px-3 py-1 text-xs"
                  onClick={() => {
                    URL.revokeObjectURL(p.preview);
                    setPending(pending.filter((x) => x.id !== p.id));
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={commit}
            disabled={uploading}
            className="btn-neon-purple px-5 py-2 mt-4"
          >
            {uploading
              ? "Subiendo..."
              : `Guardar ${pending.length} Nivel${pending.length === 1 ? "" : "es"}`}
          </button>
        </div>
      )}

      {opts.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] tracking-widest text-muted-foreground mb-3" >
            NIVELES ACTUALES · {opts.length}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {opts.map((o) => (
              <div key={o.id} className="panel-cyber p-2">
                <div className="flex justify-center mb-2">
                  <img
                    src={o.image_url}
                    alt={o.title}
                    className="block max-h-48 max-w-full w-auto h-auto"
                  />
                </div>
                <input
                  className="input-cyber w-full text-sm mb-2"
                  defaultValue={o.title}
                  onBlur={async (e) => {
                    const title = e.target.value;
                    if (title !== o.title) {
                      await updateOption({ ...o, title });
                      await refresh();
                    }
                  }}
                />
                <button
                  className="btn-neon-red w-full py-1 text-xs"
                  onClick={async () => {
                    if (confirm(`¿Borrar "${o.title}"?`)) {
                      await deleteOption(o.id);
                      await refresh();
                    }
                  }}
                >
                  Borrar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
