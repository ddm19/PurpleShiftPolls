import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addOptions,
  deleteOption,
  deleteQuestion,
  getOptionsForQuestion,
  getQuestions,
  reorderQuestions,
  uid,
  updateOption,
  uploadLevelImage,
  upsertQuestion,
  type LevelOption,
  type Question,
  type QuestionType,
} from "@/lib/store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Purple Shift — Admin Console" },
      { name: "description", content: "Admin console for Purple Shift survey." },
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
            // SECURE TERMINAL
          </div>
          <h1 className="neon-text-red text-3xl font-bold tracking-widest flicker">
            ACCESS GATE
          </h1>
        </div>
        <label className="block text-[10px] tracking-widest text-muted-foreground mb-2">
          AUTH KEY
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
          className={`input-cyber w-full text-center text-2xl tracking-[0.5em] ${
            err ? "neon-border-red" : ""
          }`}
          placeholder="••••"
        />
        {err && (
          <div className="neon-text-red text-xs mt-3 tracking-widest text-center">
            ✕ AUTH DENIED
          </div>
        )}
        <button onClick={submit} className="btn-neon-purple w-full py-3 mt-6">
          Authenticate
        </button>
        <div className="text-center mt-6">
          <a href="/" className="text-xs text-muted-foreground hover:neon-text-blue tracking-widest">
            ← BACK TO SURVEY
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
      order: questions.length + 1,
      choices: [],
    });
  };

  return (
    <div className="relative z-10 min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between border-b border-border/40">
        <div>
          <span className="neon-text-purple text-xl font-bold tracking-[0.3em]">ADMIN</span>
          <span className="neon-text-red text-xl font-bold tracking-[0.3em] ml-1">::CONSOLE</span>
        </div>
        <div className="flex gap-3">
          <a href="/" className="btn-neon-blue px-4 py-2 text-xs">View Survey</a>
          <button onClick={onLock} className="btn-neon-red px-4 py-2 text-xs">Lock</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold neon-text-blue tracking-widest">QUESTIONS</h1>
          <button onClick={newQuestion} className="btn-neon-purple px-5 py-2">
            + New Question
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
              // no questions defined. click "new question" to begin.
            </div>
          )}
          {questions.map((q) => (
            <QuestionRow
              key={q.id}
              q={q}
              onEdit={() => setEditing(q)}
              onDelete={async () => {
                if (confirm(`Delete "${q.text_prompt}"?`)) {
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
}: {
  q: Question;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="panel-cyber p-5 flex items-center gap-4">
      <div className="text-xs text-muted-foreground w-10">
        #{String(q.order).padStart(2, "0")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] tracking-widest neon-text-blue mb-1">
          {q.type.toUpperCase().replace("_", " ")}
        </div>
        <div className="font-bold truncate">{q.text_prompt || "(untitled)"}</div>
      </div>
      <div className="flex gap-1">
        <button className="btn-neon-blue px-2 py-1 text-xs" onClick={() => onMove(-1)}>↑</button>
        <button className="btn-neon-blue px-2 py-1 text-xs" onClick={() => onMove(1)}>↓</button>
        <button className="btn-neon-blue px-3 py-1 text-xs" onClick={onEdit}>Edit</button>
        <button className="btn-neon-red px-3 py-1 text-xs" onClick={onDelete}>Del</button>
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
          : undefined,
    };
    onSave(cleaned);
  };

  return (
    <div className="panel-cyber p-6 neon-border-purple slide-in">
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2">
          <Label>Prompt</Label>
          <input
            className="input-cyber w-full"
            value={q.text_prompt}
            onChange={(e) => setQ({ ...q, text_prompt: e.target.value })}
            placeholder="Enter the question prompt..."
          />
        </div>
        <div>
          <Label>Type</Label>
          <select
            className="input-cyber w-full"
            value={q.type}
            onChange={(e) => setQ({ ...q, type: e.target.value as QuestionType })}
          >
            <option value="text">Text Input</option>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="level_gallery">Level Gallery</option>
          </select>
        </div>
      </div>

      {q.type === "multiple_choice" && (
        <div className="mb-4">
          <Label>Choices (one per line)</Label>
          <textarea
            className="input-cyber w-full font-mono"
            rows={4}
            value={choicesText}
            onChange={(e) => setChoicesText(e.target.value)}
            placeholder={"Option A\nOption B\nOption C"}
          />
        </div>
      )}

      {q.type === "level_gallery" && <LevelManager questionId={q.id} />}

      <div className="flex justify-end gap-3 mt-6">
        <button className="btn-neon-red px-5 py-2" onClick={onCancel}>Cancel</button>
        <button className="btn-neon-purple px-6 py-2" onClick={save}>Save Question</button>
      </div>
    </div>
  );
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
        const { image_url, image_path } = await uploadLevelImage(questionId, p.file);
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
      <Label>Level Images</Label>

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
        className={`border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
          dragging
            ? "neon-border-purple bg-primary/5"
            : "border-border hover:border-primary/60"
        }`}
      >
        <div className="neon-text-purple text-3xl mb-2">⬆</div>
        <div className="tracking-widest text-sm">DROP IMAGES OR CLICK TO UPLOAD</div>
        <div className="text-xs text-muted-foreground mt-1">multiple files supported</div>
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

      {error && (
        <div className="neon-text-red text-xs mt-2 tracking-widest">✕ {error}</div>
      )}

      {pending.length > 0 && (
        <div className="mt-4 panel-cyber p-4">
          <div className="text-[10px] tracking-widest neon-text-blue mb-3">
            PENDING UPLOAD · {pending.length}
          </div>
          <div className="space-y-2">
            {pending.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <img src={p.preview} alt="" className="w-14 h-14 object-cover border border-border" />
                <input
                  className="input-cyber flex-1"
                  value={p.title}
                  onChange={(e) => {
                    const next = [...pending];
                    next[i] = { ...p, title: e.target.value };
                    setPending(next);
                  }}
                  placeholder="Level title..."
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
              ? "Uploading..."
              : `Save ${pending.length} Level${pending.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {opts.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
            CURRENT LEVELS · {opts.length}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {opts.map((o) => (
              <div key={o.id} className="panel-cyber p-2">
                <div className="aspect-video overflow-hidden mb-2">
                  <img src={o.image_url} alt={o.title} className="w-full h-full object-cover" />
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
                    if (confirm(`Delete "${o.title}"?`)) {
                      await deleteOption(o.id);
                      await refresh();
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
