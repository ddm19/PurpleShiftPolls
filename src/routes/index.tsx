import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  getOptionsForQuestion,
  getQuestions,
  addResponses,
  type Question,
  type LevelOption,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Purple Shift — Operator Survey" },
      {
        name: "description",
        content:
          "Help shape Purple Shift. Vote on levels, combat styles and more in the operator survey.",
      },
      { property: "og:title", content: "Purple Shift — Operator Survey" },
      {
        property: "og:description",
        content: "Cyberpunk survey for the upcoming game Purple Shift.",
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

  const current = questions[idx];

  const next = async (value: string) => {
    if (!current) return;
    const updated = { ...answers, [current.id]: value };
    setAnswers(updated);
    if (idx + 1 >= questions.length) {
      try {
        setSubmitting(true);
        await addResponses(
          Object.entries(updated).map(([question_id, answer]) => ({
            question_id,
            answer,
          })),
        );
        setDone(true);
      } catch (e: any) {
        setError(e?.message ?? String(e));
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
        <p className="text-muted-foreground">// loading survey grid...</p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="panel-cyber p-8">
          <h2 className="neon-text-red text-xl mb-3 tracking-widest">
            ✕ CONNECTION ERROR
          </h2>
          <p className="text-muted-foreground text-sm mb-2">
            // could not reach the mainframe.
          </p>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell>
        <div className="panel-cyber p-8 text-center">
          <p className="text-muted-foreground">
            // no questions configured. visit{" "}
            <a href="/admin" className="neon-text-blue">/admin</a> to set them up.
          </p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="slide-in text-center">
          <h1 className="neon-text-purple text-5xl font-bold mb-4 flicker">
            TRANSMISSION RECEIVED
          </h1>
          <p className="text-muted-foreground mb-8">
            // your input has been logged to the mainframe.
          </p>
          <button
            className="btn-neon-blue px-8 py-3"
            onClick={() => {
              setAnswers({});
              setIdx(0);
              setDone(false);
            }}
          >
            New Operator
          </button>
        </div>
      </Shell>
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-border/40">
        <div>
          <span className="neon-text-purple text-xl font-bold tracking-[0.3em]">
            PURPLE
          </span>
          <span className="neon-text-red text-xl font-bold tracking-[0.3em] ml-1">
            ::SHIFT
          </span>
          <div className="text-[10px] text-muted-foreground tracking-widest mt-0.5">
            OPERATOR SURVEY v0.1
          </div>
        </div>
        <a
          href="/admin"
          className="text-xs text-muted-foreground hover:neon-text-blue tracking-widest"
        >
          [ ADMIN ]
        </a>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100;
  return (
    <div className="mb-8">
      <div className="flex justify-between text-[10px] tracking-widest text-muted-foreground mb-2">
        <span>QUERY {String(current).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
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
  if (question.type === "multiple_choice")
    return <ChoiceQuestion q={question} onAnswer={onAnswer} disabled={disabled} />;
  return <GalleryQuestion q={question} onAnswer={onAnswer} disabled={disabled} />;
}

function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl md:text-3xl font-bold mb-8 leading-snug">
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
    <div className="panel-cyber p-8">
      <Prompt>{q.text_prompt}</Prompt>
      <input
        autoFocus
        className="input-cyber w-full text-lg"
        placeholder="enter response..."
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim() && !disabled) onAnswer(val.trim());
        }}
      />
      <div className="mt-6 flex justify-end">
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={!val.trim() || disabled}
          onClick={() => onAnswer(val.trim())}
        >
          Transmit →
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
    <div className="panel-cyber p-8">
      <Prompt>{q.text_prompt}</Prompt>
      <div className="space-y-3">
        {(q.choices ?? []).map((c) => {
          const isSel = selected === c;
          return (
            <button
              key={c}
              onClick={() => setSelected(c)}
              className={`w-full text-left px-5 py-4 border transition-all tracking-wide ${isSel
                  ? "neon-border-purple neon-text-purple"
                  : "border-border hover:border-primary/60"
                }`}
            >
              <span className="text-muted-foreground mr-3">
                [{isSel ? "■" : " "}]
              </span>
              {c}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={!selected || disabled}
          onClick={() => selected && onAnswer(selected)}
        >
          Confirm →
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
      // Set initial focus to the middle card for better presentation
      .then((opts) => alive && setOptions(opts))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q.id]);

  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    const onScroll = () => {
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
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, [options]);

  const focused = useMemo(() => options[focusedIdx], [options, focusedIdx]);

  const scrollTo = (index: number) => {
    const container = scrollerRef.current;
    if (!container) return;
    const card = container.querySelectorAll<HTMLDivElement>("[data-card]")[index];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
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
        <p className="text-muted-foreground">// fetching level data...</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="panel-cyber p-8 text-center">
        <Prompt>{q.text_prompt}</Prompt>
        <p className="text-muted-foreground mb-6">
          // no level data uploaded yet. visit /admin to load levels.
        </p>
        <button className="btn-neon-blue px-6 py-2" onClick={() => onAnswer("__skipped__")}>
          Skip →
        </button>
      </div>
    );
  }

  return (
    <div>
      <Prompt>{q.text_prompt}</Prompt>
      <div className="relative">
        <div
          ref={scrollerRef}
          className="scrollbar-cyber flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 px-[20%]"
          style={{ scrollPaddingInline: "20%" }}
        >
          {options.map((opt, i) => (
            <LevelCard key={opt.id} opt={opt} active={i === focusedIdx} />
          ))}
        </div>
        <button
          onClick={scrollPrev}
          disabled={focusedIdx === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 btn-neon-blue p-2 w-12 h-12 rounded-full disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Previous level"
        >
          {"<"}
        </button>
        <button
          onClick={scrollNext}
          disabled={focusedIdx === options.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 btn-neon-blue p-2 w-12 h-12 rounded-full disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Next level"
        >
          {">"}
        </button>
      </div>
      <div className="mt-6 text-center">
        <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
          SELECTED // {focusedIdx + 1} OF {options.length}
        </div>
        <div className="h-8 mb-3 text-lg neon-text-purple font-bold tracking-widest transition-opacity duration-300">
          {focused?.title}
        </div>
        <button
          className="btn-neon-purple px-10 py-4 text-base"
          disabled={disabled || !focused}
          onClick={() => focused && onAnswer(focused.id)}
        >
          ▶ Vote For This Level
        </button>
      </div>
    </div>
  );
}

function LevelCard({ opt, active }: { opt: LevelOption; active: boolean }) {
  return (
    <div
      data-card
      className={`snap-center shrink-0 w-[300px] md:w-[380px] transition-all duration-500 ${active ? "scale-100 opacity-100" : "scale-90 opacity-50"
        }`}
    >
      <div
        className={`relative aspect-[4/5] overflow-hidden ${active ? "neon-border-purple" : "border border-border"
          }`}
      >
        {opt.image_url ? (
          <img
            src={opt.image_url}
            alt={opt.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
            no image
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-5">
          <div className="text-[10px] tracking-widest text-muted-foreground mb-1">
            LEVEL FILE
          </div>
          <div
            className={`text-xl font-bold ${active ? "neon-text-purple" : "text-foreground"
              }`}
          >
            {opt.title}
          </div>
        </div>
      </div>
    </div>
  );
}
