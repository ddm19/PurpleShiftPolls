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
import { type Locale, translate, getPrompt, getChoices } from "@/lib/i18n";

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
  const [locale, setLocale] = useState<Locale | null>(null);

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

  if (locale === null) {
    return (
      <Shell locale="es">
        <LanguageGate onSelect={setLocale} />
      </Shell>
    );
  }

  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  if (loading) {
    return (
      <Shell locale={locale}>
        <p className="text-muted-foreground">{t("loading_survey")}</p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell locale={locale}>
        <div className="panel-cyber p-6 sm:p-8">
          <h2 className="neon-text-red text-lg sm:text-xl mb-3 tracking-widest">
            {t("error_title")}
          </h2>
          <p className="text-muted-foreground text-sm mb-2">{t("error_subtitle")}</p>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{error}</pre>
        </div>
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell locale={locale}>
        <div className="panel-cyber p-8 text-center">
          <p className="text-muted-foreground">
            {t("empty_questions_pre")}{" "}
            <a href="/admin" className="neon-text-blue">
              /admin
            </a>{" "}
            {t("empty_questions_post")}
          </p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <MailingListSignup
        locale={locale}
        onReset={() => {
          setAnswers({});
          setIdx(0);
          setDone(false);
          setMailingListSubmitted(false);
          setLocale(null);
        }}
        submitted={mailingListSubmitted}
        onSubmitted={() => setMailingListSubmitted(true)}
      />
    );
  }

  return (
    <Shell locale={locale}>
      <ProgressBar current={idx + 1} total={questions.length} locale={locale} />
      <div key={current.id} className="slide-in">
        <QuestionView question={current} onAnswer={next} disabled={submitting} locale={locale} />
      </div>
    </Shell>
  );
}

function LanguageGate({ onSelect }: { onSelect: (locale: Locale) => void }) {
  return (
    <div className="panel-cyber p-8 sm:p-10 text-center slide-in">
      <div className="text-[10px] tracking-[0.4em] text-muted-foreground mb-3">
        // SELECCIONA IDIOMA / SELECT LANGUAGE
      </div>
      <h2 className="neon-text-purple text-2xl sm:text-3xl font-bold mb-8 tracking-widest">
        Idioma / Language
      </h2>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button className="btn-neon-purple px-8 py-4 text-lg" onClick={() => onSelect("es")}>
          Español
        </button>
        <button className="btn-neon-blue px-8 py-4 text-lg" onClick={() => onSelect("en")}>
          English
        </button>
      </div>
    </div>
  );
}

function MailingListSignup({
  locale,
  submitted,
  onSubmitted,
  onReset,
}: {
  locale: Locale;
  submitted: boolean;
  onSubmitted: () => void;
  onReset: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError(t("invalid_email"));
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
      <Shell locale={locale}>
        <div className="slide-in text-center">
          <p className="text-muted-foreground">{t("thanks_final")}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell locale={locale}>
      <div className="slide-in text-center max-w-2xl mx-auto">
        <h1 className="neon-text-purple text-3xl sm:text-4xl font-bold mb-4">
          {t("thanks_heading")}
        </h1>
        <p className="text-muted-foreground mb-6">{t("thanks_body")}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            className="input-cyber flex-1 text-center sm:text-left"
            placeholder={t("email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <button className="btn-neon-purple px-6 py-3" onClick={handleSubmit} disabled={loading}>
            {loading ? t("sending") : t("subscribe")}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <button
          className="text-xs text-muted-foreground hover:neon-text-blue tracking-widest mt-8"
          onClick={onSubmitted}
        >
          {t("no_thanks")}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <header className="flex items-center justify-between border-b border-border/40 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-4">
          <img src="/purplelogo.png" alt="Purple Shift Logo" className="h-10 w-auto" />
          <div className="hidden sm:block">
            <div className="text-[10px] text-muted-foreground tracking-widest">
              {t("header_subtitle")}
            </div>
          </div>
        </Link>
        <a
          href="/admin"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:neon-text-blue"
        >
          {t("admin_link")}
        </a>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}

function ProgressBar({
  current,
  total,
  locale,
}: {
  current: number;
  total: number;
  locale: Locale;
}) {
  const pct = (current / total) * 100;
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex justify-between text-[10px] tracking-widest text-muted-foreground mb-2">
        <span>
          {translate(locale, "question_counter", {
            current: String(current).padStart(2, "0"),
            total: String(total).padStart(2, "0"),
          })}
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
  locale,
}: {
  question: Question;
  onAnswer: (value: string) => void;
  disabled?: boolean;
  locale: Locale;
}) {
  if (question.type === "text")
    return <TextQuestion q={question} onAnswer={onAnswer} disabled={disabled} locale={locale} />;
  if (question.type === "numeric")
    return <NumericQuestion q={question} onAnswer={onAnswer} disabled={disabled} locale={locale} />;
  if (question.type === "multiple_choice")
    return <ChoiceQuestion q={question} onAnswer={onAnswer} disabled={disabled} locale={locale} />;
  if (question.type === "slider")
    return <SliderQuestion q={question} onAnswer={onAnswer} disabled={disabled} locale={locale} />;
  return <GalleryQuestion q={question} onAnswer={onAnswer} disabled={disabled} locale={locale} />;
}

function QuestionImages({ urls, locale }: { urls?: string[]; locale: Locale }) {
  const [zoomedUrl, setZoomedUrl] = useState<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

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
              alt={t("question_image_alt")}
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
            aria-label={t("close_image")}
          >
            &times;
          </button>
          <img
            src={zoomedUrl}
            alt={t("enlarged_image_alt")}
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
  locale,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
  locale: Locale;
}) {
  const [val, setVal] = useState("");
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="panel-cyber p-6 sm:p-8">
      <Prompt>{getPrompt(q, locale)}</Prompt>
      <QuestionImages urls={q.image_urls} locale={locale} />
      <input
        autoFocus
        className="input-cyber w-full text-base sm:text-lg"
        placeholder={t("answer_placeholder")}
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
            {t("skip")}
          </button>
        )}
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={!val.trim() || disabled}
          onClick={() => onAnswer(val.trim())}
        >
          {t("transmit")}
        </button>
      </div>
    </div>
  );
}

function NumericQuestion({
  q,
  onAnswer,
  disabled,
  locale,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
  locale: Locale;
}) {
  const [val, setVal] = useState("");
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="panel-cyber p-6 sm:p-8">
      <Prompt>{getPrompt(q, locale)}</Prompt>
      <QuestionImages urls={q.image_urls} locale={locale} />
      <input
        autoFocus
        type="number"
        inputMode="numeric"
        className="input-cyber w-full text-base sm:text-lg"
        placeholder={t("numeric_placeholder")}
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
            {t("skip")}
          </button>
        )}
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={!val.trim() || disabled}
          onClick={() => onAnswer(val.trim())}
        >
          {t("transmit")}
        </button>
      </div>
    </div>
  );
}

function ChoiceQuestion({
  q,
  onAnswer,
  disabled,
  locale,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
  locale: Locale;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const choices = getChoices(q, locale);
  return (
    <div className="panel-cyber p-6 sm:p-8">
      <Prompt>{getPrompt(q, locale)}</Prompt>
      <QuestionImages urls={q.image_urls} locale={locale} />
      <div className="space-y-3">
        {choices.map((c) => {
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
            {t("skip")}
          </button>
        )}
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={!selected || disabled}
          onClick={() => selected && onAnswer(selected)}
        >
          {t("confirm")}
        </button>
      </div>
    </div>
  );
}

function SliderQuestion({
  q,
  onAnswer,
  disabled,
  locale,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
  locale: Locale;
}) {
  const min = q.slider_min ?? 0;
  const max = q.slider_max ?? 10;
  const [val, setVal] = useState<number>(Math.round((min + max) / 2));
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <div className="panel-cyber p-6 sm:p-8">
      <Prompt>{getPrompt(q, locale)}</Prompt>
      <QuestionImages urls={q.image_urls} locale={locale} />

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
            {t("skip")}
          </button>
        )}
        <button
          className="btn-neon-purple px-8 py-3"
          disabled={disabled}
          onClick={() => onAnswer(String(val))}
        >
          {t("confirm")}
        </button>
      </div>
    </div>
  );
}

function GalleryQuestion({
  q,
  onAnswer,
  disabled,
  locale,
}: {
  q: Question;
  onAnswer: (v: string) => void;
  disabled?: boolean;
  locale: Locale;
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

  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  if (loading) {
    return (
      <div className="panel-cyber p-8 text-center">
        <Prompt>{getPrompt(q, locale)}</Prompt>
        <p className="text-muted-foreground">{t("gallery_loading")}</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="panel-cyber p-8 text-center">
        <Prompt>{getPrompt(q, locale)}</Prompt>
        <p className="text-muted-foreground mb-6">{t("gallery_empty")}</p>
        {q.is_optional && (
          <button className="btn-neon-blue px-6 py-2" onClick={() => onAnswer("")}>
            {t("skip")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <Prompt>{getPrompt(q, locale)}</Prompt>
      <QuestionImages urls={q.image_urls} locale={locale} />
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
            <LevelCard key={opt.id} opt={opt} active={i === focusedIdx} locale={locale} />
          ))}
        </div>
        <button
          onClick={scrollPrev}
          disabled={focusedIdx === 0}
          className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 btn-neon-blue p-2 w-10 h-10 sm:w-12 sm:h-12 rounded-full disabled:opacity-20 disabled:cursor-not-allowed z-10"
          aria-label={t("previous_level")}
        >
          {"<"}
        </button>
        <button
          onClick={scrollNext}
          disabled={focusedIdx === options.length - 1}
          className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 btn-neon-blue p-2 w-10 h-10 sm:w-12 sm:h-12 rounded-full disabled:opacity-20 disabled:cursor-not-allowed z-10"
          aria-label={t("next_level")}
        >
          {">"}
        </button>
      </div>
      <div className="mt-4 sm:mt-6 text-center">
        <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
          {t("selected_counter", { current: focusedIdx + 1, total: options.length })}
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
              {t("skip")}
            </button>
          )}
          <button
            className="btn-neon-purple px-10 py-4 text-base"
            disabled={disabled || !focused}
            onClick={() => focused && onAnswer(focused.id)}
          >
            {t("vote_level")}
          </button>
        </div>
      </div>
    </div>
  );
}

function LevelCard({
  opt,
  active,
  locale,
}: {
  opt: LevelOption;
  active: boolean;
  locale: Locale;
}) {
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
          {translate(locale, "no_image")}
        </div>
      )}
    </div>
  );
}
