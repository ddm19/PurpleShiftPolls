import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getAllResponses, getQuestions, type Question, type Response } from "@/lib/store";

export const Route = createFileRoute("/admin/responses")({
  component: ResponsesPage,
});

type ResponsesByQuestion = Record<string, Response[]>;
type ResponsesByUser = Record<
  string,
  {
    responses: Record<string, string | null>;
    date: Date;
  }
>;

function processData(responses: Response[], questions: Question[]) {
  const byQuestion: ResponsesByQuestion = {};
  const byUser: ResponsesByUser = {};

  for (const q of questions) {
    byQuestion[q.id] = [];
  }

  for (const r of responses) {
    if (r.question_id in byQuestion) {
      byQuestion[r.question_id].push(r);
    }

    if (!byUser[r.user_id]) {
      byUser[r.user_id] = { responses: {}, date: new Date(r.created_at) };
    }
    byUser[r.user_id].responses[r.question_id] = r.answer;
    const rDate = new Date(r.created_at);
    if (rDate > byUser[r.user_id].date) {
      byUser[r.user_id].date = rDate;
    }
  }

  return { byQuestion, byUser };
}

function ResponsesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [view, setView] = useState<"summary" | "users">("summary");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [qs, rs] = await Promise.all([getQuestions(), getAllResponses()]);
        setQuestions(qs);
        setResponses(rs);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const { byQuestion, byUser } = useMemo(
    () => processData(responses, questions),
    [responses, questions],
  );
  const users = useMemo(
    () => Object.entries(byUser).sort((a, b) => b[1].date.getTime() - a[1].date.getTime()),
    [byUser],
  );

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">// Cargando respuestas...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-400">Error: {error}</div>;
  }

  const selectedUserData = selectedUser ? byUser[selectedUser] : null;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold neon-text-purple tracking-widest mb-6">
        Análisis de Respuestas
      </h1>

      <div className="flex gap-2 mb-6 border-b border-border/40">
        <button
          onClick={() => setView("summary")}
          className={`px-4 py-2 text-sm ${view === "summary" ? "neon-text-blue border-b-2 border-blue-500" : "text-muted-foreground"}`}
        >
          Resumen
        </button>
        <button
          onClick={() => setView("users")}
          className={`px-4 py-2 text-sm ${view === "users" ? "neon-text-blue border-b-2 border-blue-500" : "text-muted-foreground"}`}
        >
          Por Usuario
        </button>
      </div>

      {view === "summary" && (
        <AnalyticsSummary questions={questions} byQuestion={byQuestion} totalUsers={users.length} />
      )}

      {view === "users" && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <h2 className="text-lg font-bold mb-3">Participantes ({users.length})</h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
              {users.map(([userId, data]) => (
                <button
                  key={userId}
                  onClick={() => setSelectedUser(userId)}
                  className={`w-full text-left panel-cyber p-3 transition-all ${selectedUser === userId ? "neon-border-purple" : "hover:bg-primary/10"}`}
                >
                  <p className="text-xs font-mono truncate">{userId}</p>
                  <p className="text-[10px] text-muted-foreground">{data.date.toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            {selectedUserData ? (
              <UserDetailView user={selectedUserData} questions={questions} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>// Selecciona un usuario para ver sus respuestas.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsSummary({
  questions,
  byQuestion,
  totalUsers,
}: {
  questions: Question[];
  byQuestion: ResponsesByQuestion;
  totalUsers: number;
}) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="panel-cyber p-4">
          <p className="text-sm text-muted-foreground">Participantes</p>
          <p className="text-3xl font-bold neon-text-purple">{totalUsers}</p>
        </div>
        <div className="panel-cyber p-4">
          <p className="text-sm text-muted-foreground">Total Respuestas</p>
          <p className="text-3xl font-bold neon-text-purple">
            {Object.values(byQuestion).flat().length}
          </p>
        </div>
      </div>

      {questions.map((q) => (
        <div key={q.id} className="panel-cyber p-6">
          <h3 className="font-bold text-lg mb-1">{q.text_prompt}</h3>
          <p className="text-xs text-muted-foreground mb-4">
            #{q.order} · {q.type.replace("_", " ")} · {byQuestion[q.id]?.length ?? 0} respuestas
          </p>
          <QuestionAnalytics question={q} responses={byQuestion[q.id] ?? []} />
        </div>
      ))}
    </div>
  );
}

function QuestionAnalytics({ question, responses }: { question: Question; responses: Response[] }) {
  const answers = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of responses) {
      if (r.answer === null || r.answer === "") continue;
      counts[r.answer] = (counts[r.answer] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [responses]);

  const total = answers.reduce((sum, [, count]) => sum + count, 0);

  if (question.type === "multiple_choice" || question.type === "level_gallery") {
    const options = question.type === "multiple_choice" ? (question.choices ?? []) : [];
    const answerMap = new Map(answers);

    return (
      <div className="space-y-2">
        {options.map((opt) => {
          const count = answerMap.get(opt) || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={opt}>
              <div className="flex justify-between text-sm mb-1">
                <span className="truncate">{opt}</span>
                <span className="text-muted-foreground">{count} votos</span>
              </div>
              <div className="h-4 bg-primary/10 w-full">
                <div className="h-full bg-purple-500" style={{ width: `${pct}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (question.type === "slider") {
    const min = question.slider_min ?? 0;
    const max = question.slider_max ?? 10;
    const range = max - min;
    const buckets = 10;
    const bucketSize = range / buckets;
    const bucketCounts = Array(buckets).fill(0);

    for (const r of responses) {
      if (r.answer === null) continue;
      const val = Number(r.answer);
      if (isNaN(val)) continue;
      const bucketIndex = Math.min(buckets - 1, Math.floor((val - min) / bucketSize));
      bucketCounts[bucketIndex]++;
    }

    const maxCount = Math.max(...bucketCounts);

    return (
      <div className="flex items-end gap-1 h-24">
        {bucketCounts.map((count, i) => {
          const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const label = min + i * bucketSize;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end group">
              <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
                {count}
              </div>
              <div
                className="w-full bg-purple-500/50 hover:bg-purple-400"
                style={{ height: `${height}%` }}
              ></div>
              <div className="text-[10px] text-muted-foreground mt-1">{Math.round(label)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (question.type === "text" || question.type === "numeric") {
    return (
      <div className="max-h-48 overflow-y-auto space-y-1 text-sm bg-black/20 p-2">
        {responses
          .filter((r) => r.answer)
          .map((r) => (
            <p key={r.id} className="border-b border-border/20 pb-1">
              {r.answer}
            </p>
          ))}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      // No hay visualización para este tipo de pregunta.
    </p>
  );
}

function UserDetailView({
  user,
  questions,
}: {
  user: ResponsesByUser[string];
  questions: Question[];
}) {
  return (
    <div className="panel-cyber p-6">
      <h2 className="text-lg font-bold mb-1">Respuestas del Participante</h2>
      <p className="text-xs font-mono text-muted-foreground mb-6">
        {Object.keys(user.responses)[0]}
      </p>

      <div className="space-y-4">
        {questions.map((q) => {
          const answer = user.responses[q.id];
          const hasAnswer = answer !== null && answer !== undefined && answer !== "";
          return (
            <div key={q.id}>
              <p className="text-sm font-bold">{q.text_prompt}</p>
              {hasAnswer ? (
                <p className="text-purple-400 pl-4">{answer}</p>
              ) : (
                <p className="text-muted-foreground/50 pl-4 italic">// Omitida</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
