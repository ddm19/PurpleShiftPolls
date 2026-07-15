import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getOptionsForQuestion,
  getQuestions,
  addResponses,
  addToMailingList,
  uid,
  type Question,
  type LevelOption,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Purple Shift" },
      {
        name: "description",
        content:
          "Ayuda a dar forma a Purple Shift. Vota por niveles, estilos de combate y más en la encuesta de playtest.",
      },
      { property: "og:title", content: "Purple Shift — Encuesta de Playtest" },
      {
        property: "og:description",
        content: "v26.07.14",
      },
    ],
  }),
  component: SurveyPage,
});

function SurveyPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState("");
  const [mailingListSubmitted, setMailingListSubmitted] = useState(false);

  useEffect(() => {
    let alive = true;
    getQuestions()
      .then((qs) => {
        if (!alive) return;
        setQuestions(qs);
      })
      .catch((e) => alive && setError(e?.message ?? String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Generate a new user ID only when a new survey starts (when `done` becomes false)
    if (!done) {
      setUserId(uid());
    }
  }, [done]);

  const current = questions[idx];

  const next = async (value: string) => {
    if (!current) return;
    const updated = { ...answers, [current.id]: value };
    setAnswers(updated);
    if (idx + 1 >= questions.length) {
      try {
        setSubmitting(true);
        await addResponses(
          userId,
          Object.entries(updated).map(([question_id, answer]) => ({
            question_id,
            answer,
          })),
        );
        setDone(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
    } else {
      setIdx(idx + 1);
    }
  };

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">// cargando red de encuestas...</p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="panel-cyber p-6 sm:p-8">
          <h2 className="neon-text-red text-lg sm:text-xl mb-3 tracking-widest">
            ✕ ERROR DE CONEXIÓN
          </h2>
          <p className="text-muted-foreground text-sm mb-2">
            // no se pudo conectar con el servidor central.
          </p>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{error}</pre>
        </div>
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell>
        <div className="panel-cyber p-8 text-center">
          <p className="text-muted-foreground">
            // no hay preguntas configuradas. visita{" "}
            <a href="/admin" className="neon-text-blue">
              /admin
            </a>{" "}
            para configurarlas.
          </p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <MailingListSignup
        onReset={() => {
          setAnswers({});
          setIdx(0);
          setDone(false);
          setMailingListSubmitted(false);
        }}
        submitted={mailingListSubmitted}
        onSubmitted={() => setMailingListSubmitted(true)}
      />
    );
  }

  return (
    <Shell>
      <ProgressBar current={idx + 1} total={questions.length} />
      <div key={current.id} className="slide-in">
        <QuestionView question={current} onAnswer={next} disabled={submitting} />
      </div>
    </Shell>
  );
}

function MailingListSignup({
  submitted,
  onSubmitted,
  onReset,
}: {
  submitted: boolean;
  onSubmitted: () => void;
  onReset: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Por favor, introduce un correo electrónico válido.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await addToMailingList(email);
      onSubmitted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Shell>
        <div className="slide-in text-center">
          <p className="text-muted-foreground">Gracias por completar la encuesta.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="slide-in text-center max-w-2xl mx-auto">
        <h1 className="neon-text-purple text-3xl sm:text-4xl font-bold mb-4">
          Gracias por completar la encuesta
        </h1>
        <p className="text-muted-foreground mb-6">
          ¿Te gustaría saber más sobre Purple Shift? Anótate en nuestra lista de correo para recibir
          noticias y actualizaciones.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            className="input-cyber flex-1 text-center sm:text-left"
            placeholder="tu-correo@electronico.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <button className="btn-neon-purple px-6 py-3" onClick={handleSubmit} disabled={loading}>
            {loading ? "Enviando..." : "Suscribirme"}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <button
          className="text-xs text-muted-foreground hover:neon-text-blue tracking-widest mt-8"
          onClick={onSubmitted}
        >
          No, gracias
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <header className="flex items-center justify-between border-b border-border/40 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-4">
          <img src="/purplelogo.png" alt="Purple Shift Logo" className="h-10 w-auto" />
          <div className="hidden sm:block">
            <div className="text-[10px] text-muted-foreground tracking-widest">
              Encuesta de Playtest de la versión v26.07.14
            </div>
          </div>
        </Link>
        <a
          href="/admin"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:neon-text-blue"
        >
          [ ADMIN ]
        </a>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100;
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex justify-between text-[10px] tracking-widest text-muted-foreground mb-2">
        <span>
          PREGUNTA {String(current).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <span className="neon-text-blue">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 bg-muted overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, var(--neon-blue), var(--neon-purple), var(--neon-red))",
            boxShadow: "0 0 12px var(--neon-purple)",
          }}
        />
      </div>
    </div>
  );
}

function QuestionView({
  question,
  onAnswer,
  disabled,
}: {
  question: Question;
  onAnswer: (value: string) => void;
  disabled?: boolean;
}) {
  if (question.type === "text")
    return <TextQuestion q={question} onAnswer={onAnswer} disabled={disabled} />;
  if (question.type === "numeric")
    return <NumericQuestion q={question} onAnswer={onAnswer} disabled={disabled} />;
  if (question.type === "multiple_choice")
    return <ChoiceQuestion q={question} onAnswer={onAnswer} disabled={disabled} />;
  if (question.type === "slider")
    return <SliderQuestion q={question} onAnswer={onAnswer} disabled={disabled} />;
  return <GalleryQuestion q={question} onAnswer={onAnswer} disabled={disabled} />;
}

function QuestionImages({ urls }: { urls?: string[] }) {
  const [zoomedUrl, setZoomedUrl] = useState<string | null>(null);

  if (!urls || urls.length === 0) return null;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 md:grid-cols-4">
        {urls.map((url) => (
          <button
            key={url}
            onClick={() => setZoomedUrl(url)}
            className="focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <img
              src={url}
              alt="Imagen de la pregunta"
              className="h-auto w-full max-h-48 rounded-sm object-contain"
            />
          </button>
        ))}
      </div>

      {zoomedUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomedUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-4xl z-50"
            aria-label="Cerrar imagen"
          >
            &times;
          </button>
          <img
            src={zoomedUrl}
            alt="Imagen ampliada"
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()} // Evita que el clic en la imagen cierre el modal
          />
        </div>
      )}
    </>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8 leading-snug">
      <span className="neon-text-purple mr-2">{">"}</span>
      {children}
    </h2>
  );
}

function TextQuestion({
  q,
  onAnswer,
  disabled,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
}) {
  const [val, setVal] = useState("");
  return (
    <div className="panel-cyber p-6 sm:p-8">
      <Prompt>{q.text_prompt}</Prompt>
      <QuestionImages urls={q.image_urls} />
      <input
        autoFocus
        className="input-cyber w-full text-base sm:text-lg"
        placeholder="introduce tu respuesta..."
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim() && !disabled) onAnswer(val.trim());
        }}
      />
      <div className="mt-6 flex justify-end gap-4">
        {q.is_optional && (
          <button
            className="btn-neon-blue px-6 py-3"
            disabled={disabled}
            onClick={() => onAnswer("")}
          >
            Saltar →
          </button>
        )}
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={!val.trim() || disabled}
          onClick={() => onAnswer(val.trim())}
        >
          Transmitir →
        </button>
      </div>
    </div>
  );
}

function NumericQuestion({
  q,
  onAnswer,
  disabled,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
}) {
  const [val, setVal] = useState("");
  return (
    <div className="panel-cyber p-6 sm:p-8">
      <Prompt>{q.text_prompt}</Prompt>
      <QuestionImages urls={q.image_urls} />
      <input
        autoFocus
        type="number"
        inputMode="numeric"
        className="input-cyber w-full text-base sm:text-lg"
        placeholder="introduce un número..."
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim() && !disabled) onAnswer(val.trim());
        }}
      />
      <div className="mt-6 flex justify-end gap-4">
        {q.is_optional && (
          <button
            className="btn-neon-blue px-6 py-3"
            disabled={disabled}
            onClick={() => onAnswer("")}
          >
            Saltar →
          </button>
        )}
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={!val.trim() || disabled}
          onClick={() => onAnswer(val.trim())}
        >
          Transmitir →
        </button>
      </div>
    </div>
  );
}

function ChoiceQuestion({
  q,
  onAnswer,
  disabled,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="panel-cyber p-6 sm:p-8">
      <Prompt>{q.text_prompt}</Prompt>
      <QuestionImages urls={q.image_urls} />
      <div className="space-y-3">
        {(q.choices ?? []).map((c) => {
          const isSel = selected === c;
          return (
            <button
              key={c}
              onClick={() => setSelected(c)}
              className={`w-full text-left px-4 py-3 sm:px-5 sm:py-4 border transition-all tracking-wide ${
                isSel
                  ? "neon-border-purple neon-text-purple"
                  : "border-border hover:border-primary/60"
              }`}
            >
              <span className="text-muted-foreground mr-3">[{isSel ? "■" : " "}]</span>
              {c}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end gap-4">
        {q.is_optional && (
          <button
            className="btn-neon-blue px-6 py-3"
            disabled={disabled}
            onClick={() => onAnswer("")}
          >
            Saltar →
          </button>
        )}
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={!selected || disabled}
          onClick={() => selected && onAnswer(selected)}
        >
          Confirmar →
        </button>
      </div>
    </div>
  );
}

function SliderQuestion({
  q,
  onAnswer,
  disabled,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
}) {
  const min = q.slider_min ?? 0;
  const max = q.slider_max ?? 10;
  const [val, setVal] = useState<number>(Math.round((min + max) / 2));

  return (
    <div className="panel-cyber p-6 sm:p-8">
      <Prompt>{q.text_prompt}</Prompt>
      <QuestionImages urls={q.image_urls} />

      <div className="flex items-start gap-4 my-8">
        {q.slider_left_label && (
          <span className="text-sm text-muted-foreground text-right w-24 shrink-0 pt-1">
            {q.slider_left_label}
          </span>
        )}
        <div className="flex-1 min-w-0 pt-8">
          <div className="w-full max-w-lg mx-auto">
            <div className="relative">
              <input
                type="range"
                min={min}
                max={max}
                value={val}
                onChange={(e) => setVal(e.target.valueAsNumber)}
                className="w-full slider-cyber"
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-lg neon-text-purple font-bold">
                {val}
              </div>
            </div>
            {q.slider_labels && q.slider_labels.length > 0 && (
              <div className="relative h-6 mt-2">
                {q.slider_labels.map((label) => {
                  const percent = ((label.value - min) / (max - min)) * 100;
                  return (
                    <div
                      key={label.value}
                      className="absolute text-center text-[10px] text-muted-foreground"
                      style={{ left: `${percent}%`, transform: "translateX(-50%)" }}
                    >
                      <div className="h-1.5 w-px bg-border/70 mx-auto"></div>
                      {label.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {q.slider_right_label && (
          <span className="text-sm text-muted-foreground w-24 shrink-0 pt-1">
            {q.slider_right_label}
          </span>
        )}
      </div>

      <div className="mt-12 flex justify-end gap-4">
        {q.is_optional && (
          <button
            className="btn-neon-blue px-6 py-3"
            disabled={disabled}
            onClick={() => onAnswer("")}
          >
            Saltar →
          </button>
        )}
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={disabled}
          onClick={() => onAnswer(String(val))}
        >
          Confirmar →
        </button>
      </div>
    </div>
  );
}

function GalleryQuestion({
  q,
  onAnswer,
  disabled,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<LevelOption[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [focusedIdx, setFocusedIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    getOptionsForQuestion(q.id)
      .then((opts) => {
        if (alive) {
          setOptions(opts);
          if (opts.length > 0) {
            // Start at the middle image for better presentation
            const startIdx = Math.floor(opts.length / 2);
            setFocusedIdx(startIdx);
            setTimeout(() => scrollTo(startIdx, "auto"), 50);
          }
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q.id]);

  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    let timeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const cards = container.querySelectorAll<HTMLDivElement>("[data-card]");
        const center = container.scrollLeft + container.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        cards.forEach((card, i) => {
          const cardCenter = card.offsetLeft + card.offsetWidth / 2;
          const d = Math.abs(cardCenter - center);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        setFocusedIdx(best);
      }, 100);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [options]);

  const focused = useMemo(() => options[focusedIdx], [options, focusedIdx]);

  const scrollTo = (index: number, behavior: "smooth" | "auto" = "smooth") => {
    const container = scrollerRef.current;
    if (!container) return;
    const card = container.querySelectorAll<HTMLDivElement>("[data-card]")[index];
    if (card) {
      card.scrollIntoView({
        behavior,
        block: "nearest",
        inline: "center",
      });
    }
  };

  const scrollPrev = () => {
    const newIndex = Math.max(0, focusedIdx - 1);
    scrollTo(newIndex);
  };
  const scrollNext = () => {
    const newIndex = Math.min(options.length - 1, focusedIdx + 1);
    scrollTo(newIndex);
  };

  if (loading) {
    return (
      <div className="panel-cyber p-8 text-center">
        <Prompt>{q.text_prompt}</Prompt>
        <p className="text-muted-foreground">// obteniendo datos de niveles...</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="panel-cyber p-8 text-center">
        <Prompt>{q.text_prompt}</Prompt>
        <p className="text-muted-foreground mb-6">
          // aún no se han subido datos de niveles. visita /admin para cargarlos.
        </p>
        {q.is_optional && (
          <button className="btn-neon-blue px-6 py-2" onClick={() => onAnswer("")}>
            Saltar →
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <Prompt>{q.text_prompt}</Prompt>
      <QuestionImages urls={q.image_urls} />
      <div className="relative">
        <div
          ref={scrollerRef}
          className="scrollbar-cyber flex gap-4 md:gap-8 overflow-x-auto snap-x snap-mandatory pb-6"
          style={{
            paddingLeft: "calc(50% - 140px)",
            paddingRight: "calc(50% - 140px)",
            scrollPaddingLeft: "calc(50% - 140px)",
            scrollPaddingRight: "calc(50% - 140px)",
          }}
        >
          {options.map((opt, i) => (
            <LevelCard key={opt.id} opt={opt} active={i === focusedIdx} />
          ))}
        </div>
        <button
          onClick={scrollPrev}
          disabled={focusedIdx === 0}
          className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 btn-neon-blue p-2 w-10 h-10 sm:w-12 sm:h-12 rounded-full disabled:opacity-20 disabled:cursor-not-allowed z-10"
          aria-label="Nivel anterior"
        >
          {"<"}
        </button>
        <button
          onClick={scrollNext}
          disabled={focusedIdx === options.length - 1}
          className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 btn-neon-blue p-2 w-10 h-10 sm:w-12 sm:h-12 rounded-full disabled:opacity-20 disabled:cursor-not-allowed z-10"
          aria-label="Siguiente nivel"
        >
          {">"}
        </button>
      </div>
      <div className="mt-4 sm:mt-6 text-center">
        <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
          SELECCIONADO // {focusedIdx + 1} DE {options.length}
        </div>
        <div className="h-8 mb-3 text-lg neon-text-purple font-bold tracking-widest transition-opacity duration-300">
          {focused?.title}
        </div>
        <div className="flex justify-center gap-4">
          {q.is_optional && (
            <button
              className="btn-neon-blue px-6 py-3"
              disabled={disabled}
              onClick={() => onAnswer("")}
            >
              Saltar →
            </button>
          )}
          <button
            className="btn-neon-purple px-10 py-4 text-base"
            disabled={disabled || !focused}
            onClick={() => focused && onAnswer(focused.id)}
          >
            ▶ Votar por este Nivel
          </button>
        </div>
      </div>
    </div>
  );
}

function LevelCard({ opt, active }: { opt: LevelOption; active: boolean }) {
  return (
    <div
      data-card
      className={`snap-center shrink-0 w-[320px] sm:w-[480px] md:w-[600px] flex justify-center transition-all duration-300 ${
        active ? "scale-100 opacity-100" : "scale-90 opacity-60"
      }`}
    >
      {opt.image_url ? (
        <img
          src={opt.image_url}
          alt={opt.title}
          className="block max-h-[62vh] max-w-full w-auto h-auto"
        />
      ) : (
        <div className="min-h-48 w-full bg-muted flex items-center justify-center text-muted-foreground">
          sin imagen
        </div>
      )}
    </div>
  );
}
