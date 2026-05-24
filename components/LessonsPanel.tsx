"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LESSONS,
  QUIZZES,
  STAGES,
  loadProgress,
  markLessonComplete,
  markQuizComplete,
  lessonsInStage,
  quizzesInStage,
  isStageUnlocked,
  stageProgress,
  type Lesson,
  type Quiz,
  type LessonDifficulty,
  type StageId,
} from "@/lib/lessons";
import type { RepoState } from "@/lib/gitState";

type Tab = "lessons" | "quizzes";
type View =
  | { kind: "index" }
  | { kind: "lesson"; id: string }
  | { kind: "quiz"; id: string };

type Props = {
  open: boolean;
  onClose: () => void;
  state: RepoState;
  revision: number;
  onLoadLessonState: (state: RepoState, label: string) => void;
};

export default function LessonsPanel({
  open,
  onClose,
  state,
  revision,
  onLoadLessonState,
}: Props) {
  const [tab, setTab] = useState<Tab>("lessons");
  const [view, setView] = useState<View>({ kind: "index" });
  const [hintsShown, setHintsShown] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  // Which stages are expanded in the index view. Default: first unlocked
  // stage that still has lessons left.
  const [expandedStages, setExpandedStages] = useState<Set<StageId>>(
    () => new Set([STAGES[0].id]),
  );

  const [progress, setProgress] = useState(loadProgress);

  const activeLesson = useMemo<Lesson | null>(() => {
    if (view.kind !== "lesson") return null;
    return LESSONS.find((l) => l.id === view.id) ?? null;
  }, [view]);

  const activeQuiz = useMemo<Quiz | null>(() => {
    if (view.kind !== "quiz") return null;
    return QUIZZES.find((q) => q.id === view.id) ?? null;
  }, [view]);

  // Watch live state for lesson completion — reacts to engine mutations.
  useEffect(() => {
    if (!activeLesson) return;
    if (progress.completedLessons.includes(activeLesson.id)) return;
    if (activeLesson.isComplete(state)) {
      const next = markLessonComplete(activeLesson.id);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress(next);
    }
  }, [revision, activeLesson, progress.completedLessons, state]);

  function openLesson(l: Lesson) {
    onLoadLessonState(l.setup(), `lesson · ${l.title}`);
    setView({ kind: "lesson", id: l.id });
    setHintsShown(0);
  }

  function openQuiz(q: Quiz) {
    if (q.setup) onLoadLessonState(q.setup(), `quiz · ${q.topic}`);
    setView({ kind: "quiz", id: q.id });
    setPicked(null);
  }

  function backToIndex() {
    setView({ kind: "index" });
    setHintsShown(0);
    setPicked(null);
  }

  function restartLesson() {
    if (!activeLesson) return;
    onLoadLessonState(activeLesson.setup(), `lesson · ${activeLesson.title}`);
    setHintsShown(0);
  }

  function handleQuizPick(idx: number) {
    if (!activeQuiz) return;
    setPicked(idx);
    if (activeQuiz.options[idx].correct) {
      const next = markQuizComplete(activeQuiz.id);
      setProgress(next);
    }
  }

  function toggleStage(id: StageId) {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalLessons = LESSONS.length;
  const totalQuizzes = QUIZZES.length;

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-90 bg-black/10 transition-opacity duration-200 ease-out ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-100 h-full w-[min(440px,94vw)] bg-white border-l border-zinc-200 shadow-[-12px_0_40px_-12px_rgba(0,0,0,0.08)] flex flex-col transition-transform duration-220 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-3 border-b border-zinc-200 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[13px] font-semibold text-zinc-900">
                Learn Git
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                {progress.completedLessons.length}/{totalLessons} lessons ·{" "}
                {progress.completedQuizzes.length}/{totalQuizzes} quizzes
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 rounded-sm bg-transparent border border-zinc-200 text-zinc-400 cursor-pointer flex items-center justify-center text-sm transition-colors duration-120 hover:bg-zinc-100 hover:text-zinc-700 hover:border-zinc-300"
            >
              ✕
            </button>
          </div>

          {view.kind === "index" && (
            <div className="flex gap-1">
              <TabPill active={tab === "lessons"} onClick={() => setTab("lessons")}>
                Roadmap
              </TabPill>
              <TabPill active={tab === "quizzes"} onClick={() => setTab("quizzes")}>
                Quizzes
              </TabPill>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 scrollbar-light">
          {view.kind === "index" && tab === "lessons" && (
            <RoadmapView
              completedLessons={progress.completedLessons}
              completedQuizzes={progress.completedQuizzes}
              expanded={expandedStages}
              onToggle={toggleStage}
              onPickLesson={openLesson}
            />
          )}
          {view.kind === "index" && tab === "quizzes" && (
            <QuizRoadmap
              completedLessons={progress.completedLessons}
              completedQuizzes={progress.completedQuizzes}
              expanded={expandedStages}
              onToggle={toggleStage}
              onPickQuiz={openQuiz}
            />
          )}
          {view.kind === "lesson" && activeLesson && (
            <LessonView
              lesson={activeLesson}
              hintsShown={hintsShown}
              onShowHint={() => setHintsShown((n) => n + 1)}
              onRestart={restartLesson}
              onBack={backToIndex}
              isComplete={progress.completedLessons.includes(activeLesson.id)}
            />
          )}
          {view.kind === "quiz" && activeQuiz && (
            <QuizView
              quiz={activeQuiz}
              picked={picked}
              onPick={handleQuizPick}
              onBack={backToIndex}
              onNext={() => {
                const idx = QUIZZES.findIndex((q) => q.id === activeQuiz.id);
                const next = QUIZZES[idx + 1];
                if (next) openQuiz(next);
                else backToIndex();
              }}
              hasNext={
                QUIZZES.findIndex((q) => q.id === activeQuiz.id) <
                QUIZZES.length - 1
              }
            />
          )}
        </div>
      </aside>
    </>
  );
}

/* ─── Roadmap view (stages + lessons) ──────────────────── */

function RoadmapView({
  completedLessons,
  completedQuizzes,
  expanded,
  onToggle,
  onPickLesson,
}: {
  completedLessons: string[];
  completedQuizzes: string[];
  expanded: Set<StageId>;
  onToggle: (id: StageId) => void;
  onPickLesson: (l: Lesson) => void;
}) {
  return (
    <div className="py-2">
      {STAGES.map((stage) => {
        const unlocked = isStageUnlocked(stage.id, completedLessons);
        const prog = stageProgress(stage.id, completedLessons, completedQuizzes);
        const lessons = lessonsInStage(stage.id);
        const isExpanded = expanded.has(stage.id);
        const allDone = prog.lessons.done === prog.lessons.total && prog.lessons.total > 0;
        return (
          <div
            key={stage.id}
            className={`border-b border-zinc-100 last:border-b-0 ${
              !unlocked ? "opacity-60" : ""
            }`}
          >
            <button
              onClick={() => unlocked && onToggle(stage.id)}
              disabled={!unlocked}
              className={`w-full text-left px-5 py-3.5 transition-colors duration-120 ${
                unlocked ? "cursor-pointer hover:bg-zinc-50" : "cursor-not-allowed"
              }`}
            >
              <div className="flex items-start gap-3">
                <StageBadge order={stage.order} done={allDone} locked={!unlocked} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13.5px] font-semibold text-zinc-900">
                      {stage.title}
                    </span>
                    {!unlocked && (
                      <span className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-400 bg-zinc-100 border border-zinc-200 px-1.5 py-px rounded">
                        Locked
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-zinc-500 leading-relaxed">
                    {stage.description}
                  </p>
                  {unlocked && (
                    <div className="mt-2">
                      <StageProgressBar
                        done={prog.lessons.done}
                        total={prog.lessons.total}
                      />
                    </div>
                  )}
                </div>
                <span
                  className={`text-zinc-400 text-[10px] mt-1 shrink-0 transition-transform duration-180 ease-out ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  aria-hidden
                >
                  ▶
                </span>
              </div>
            </button>

            {unlocked && isExpanded && (
              <ul className="pb-2">
                {lessons.map((l, idx) => {
                  const done = completedLessons.includes(l.id);
                  return (
                    <li key={l.id}>
                      <button
                        onClick={() => onPickLesson(l)}
                        className="w-full text-left pl-12 pr-5 py-2 cursor-pointer transition-colors duration-120 hover:bg-zinc-50"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 inline-flex items-center justify-center w-4.5 h-4.5 rounded-full text-[9px] font-mono shrink-0 ${
                              done
                                ? "bg-emerald-500 text-white"
                                : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                            }`}
                            style={{ width: 18, height: 18 }}
                          >
                            {done ? "✓" : idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[12.5px] font-medium text-zinc-900">
                                {l.title}
                              </span>
                              <DifficultyChip d={l.difficulty} />
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-snug">
                              {l.blurb}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Quiz roadmap ─────────────────────────────────────── */

function QuizRoadmap({
  completedLessons,
  completedQuizzes,
  expanded,
  onToggle,
  onPickQuiz,
}: {
  completedLessons: string[];
  completedQuizzes: string[];
  expanded: Set<StageId>;
  onToggle: (id: StageId) => void;
  onPickQuiz: (q: Quiz) => void;
}) {
  return (
    <div className="py-2">
      {STAGES.map((stage) => {
        const unlocked = isStageUnlocked(stage.id, completedLessons);
        const quizzes = quizzesInStage(stage.id);
        if (quizzes.length === 0) return null;
        const prog = stageProgress(stage.id, completedLessons, completedQuizzes);
        const isExpanded = expanded.has(stage.id);
        const allDone = prog.quizzes.done === prog.quizzes.total;
        return (
          <div
            key={stage.id}
            className={`border-b border-zinc-100 last:border-b-0 ${
              !unlocked ? "opacity-60" : ""
            }`}
          >
            <button
              onClick={() => unlocked && onToggle(stage.id)}
              disabled={!unlocked}
              className={`w-full text-left px-5 py-3.5 transition-colors duration-120 ${
                unlocked ? "cursor-pointer hover:bg-zinc-50" : "cursor-not-allowed"
              }`}
            >
              <div className="flex items-start gap-3">
                <StageBadge order={stage.order} done={allDone} locked={!unlocked} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13.5px] font-semibold text-zinc-900">
                      {stage.title}
                    </span>
                    <span className="text-[10.5px] font-mono text-zinc-400">
                      {prog.quizzes.done}/{prog.quizzes.total}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-zinc-400 text-[10px] mt-1 shrink-0 transition-transform duration-180 ease-out ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  aria-hidden
                >
                  ▶
                </span>
              </div>
            </button>

            {unlocked && isExpanded && (
              <ul className="pb-2">
                {quizzes.map((q, idx) => {
                  const done = completedQuizzes.includes(q.id);
                  return (
                    <li key={q.id}>
                      <button
                        onClick={() => onPickQuiz(q)}
                        className="w-full text-left pl-12 pr-5 py-2 cursor-pointer transition-colors duration-120 hover:bg-zinc-50"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 inline-flex items-center justify-center rounded-full text-[9px] font-mono shrink-0 ${
                              done
                                ? "bg-emerald-500 text-white"
                                : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                            }`}
                            style={{ width: 18, height: 18 }}
                          >
                            {done ? "✓" : idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[12.5px] font-medium text-zinc-900">
                                {q.topic}
                              </span>
                              <DifficultyChip d={q.difficulty} />
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-snug">
                              {q.scenario}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Atoms ────────────────────────────────────────────── */

function StageBadge({
  order,
  done,
  locked,
}: {
  order: number;
  done: boolean;
  locked: boolean;
}) {
  const cls = locked
    ? "bg-zinc-100 text-zinc-400 border-zinc-200"
    : done
      ? "bg-emerald-500 text-white border-emerald-500"
      : "bg-zinc-900 text-white border-zinc-900";
  return (
    <span
      className={`mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-mono font-semibold border shrink-0 ${cls}`}
    >
      {locked ? "🔒" : done ? "✓" : order}
    </span>
  );
}

function StageProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 bg-zinc-100 rounded-full flex-1 overflow-hidden">
        <div
          className="h-full bg-zinc-900 rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10.5px] font-mono text-zinc-500 tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-sans text-[11.5px] font-medium px-3 py-1 rounded-full border transition-colors duration-120 cursor-pointer ${
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-600 border-zinc-200 hover:text-zinc-900 hover:border-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function DifficultyChip({ d }: { d: LessonDifficulty }) {
  const cls =
    d === "beginner"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : d === "intermediate"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-purple-50 text-purple-700 border-purple-100";
  return (
    <span
      className={`text-[9.5px] font-mono font-medium px-1.5 py-px rounded border ${cls}`}
    >
      {d}
    </span>
  );
}

/* ─── Lesson view ──────────────────────────────────────── */

function LessonView({
  lesson,
  hintsShown,
  onShowHint,
  onRestart,
  onBack,
  isComplete,
}: {
  lesson: Lesson;
  hintsShown: number;
  onShowHint: () => void;
  onRestart: () => void;
  onBack: () => void;
  isComplete: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <button
        onClick={onBack}
        className="text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors duration-120 cursor-pointer mb-3 inline-flex items-center gap-1"
      >
        ← Roadmap
      </button>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h3 className="text-[15px] font-semibold text-zinc-900">
          {lesson.title}
        </h3>
        <DifficultyChip d={lesson.difficulty} />
      </div>
      <p className="text-[12.5px] text-zinc-500 leading-relaxed mb-4">
        {lesson.blurb}
      </p>

      {/* Concept — the mini-chapter */}
      <div className="rounded-md border border-zinc-200 bg-zinc-50/60 px-3.5 py-3 mb-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-zinc-500 font-semibold mb-1.5">
          Concept
        </div>
        <p
          className="text-[12.5px] text-zinc-800 leading-relaxed"
          /* Allow markdown-like **bold** in concept text. We render safely
             by only honoring the **...** pattern, no full markdown. */
          dangerouslySetInnerHTML={{
            __html: renderConceptText(lesson.concept),
          }}
        />
      </div>

      {/* Goal */}
      <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3.5 py-3 mb-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-blue-700 font-semibold mb-1.5">
          Goal
        </div>
        <p
          className="text-[12.5px] text-zinc-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderConceptText(lesson.goal) }}
        />
      </div>

      {/* Completion banner */}
      {isComplete && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-3 mb-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-emerald-700 font-semibold mb-1.5">
            ✓ Complete
          </div>
          {lesson.successNote && (
            <p className="text-[12.5px] text-emerald-900 leading-relaxed">
              {lesson.successNote}
            </p>
          )}
        </div>
      )}

      {/* Hints */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-zinc-500 font-semibold">
            Hints ({hintsShown}/{lesson.hints.length})
          </span>
          {hintsShown < lesson.hints.length && (
            <button
              onClick={onShowHint}
              className="text-[11px] text-blue-600 hover:text-blue-800 transition-colors duration-120 cursor-pointer"
            >
              {hintsShown === 0 ? "Show hint" : "Show next hint"}
            </button>
          )}
        </div>
        {hintsShown === 0 ? (
          <p className="text-[11.5px] text-zinc-400 italic">
            Try first. Reveal hints only if you&apos;re stuck.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {lesson.hints.slice(0, hintsShown).map((h, i) => (
              <li
                key={i}
                className="text-[12px] text-zinc-700 leading-relaxed font-mono bg-zinc-50 border border-zinc-100 rounded px-2.5 py-1.5"
              >
                {h}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
        <button
          onClick={onRestart}
          className="font-mono text-[11px] text-zinc-600 bg-white border border-zinc-200 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors duration-120 hover:text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
        >
          Restart lesson
        </button>
        <span className="text-[10.5px] text-zinc-400 font-mono">
          (resets the canvas)
        </span>
      </div>
    </div>
  );
}

// Minimal-risk inline formatter: **bold** and `code` only. Everything else
// is HTML-escaped so user-supplied content can't inject markup.
function renderConceptText(s: string): string {
  const escape = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  let out = escape(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-zinc-900">$1</strong>');
  out = out.replace(
    /`([^`]+)`/g,
    '<code class="font-mono text-[11.5px] bg-zinc-100 border border-zinc-200 rounded px-1 py-px">$1</code>',
  );
  return out;
}

/* ─── Quiz view ────────────────────────────────────────── */

function QuizView({
  quiz,
  picked,
  onPick,
  onBack,
  onNext,
  hasNext,
}: {
  quiz: Quiz;
  picked: number | null;
  onPick: (idx: number) => void;
  onBack: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const answered = picked !== null;
  return (
    <div className="px-5 py-4">
      <button
        onClick={onBack}
        className="text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors duration-120 cursor-pointer mb-3 inline-flex items-center gap-1"
      >
        ← Quizzes
      </button>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h3 className="text-[15px] font-semibold text-zinc-900">{quiz.topic}</h3>
        <DifficultyChip d={quiz.difficulty} />
      </div>

      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 mb-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-zinc-500 font-semibold mb-1">
          Scenario
        </div>
        <p
          className="text-[12.5px] text-zinc-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderConceptText(quiz.scenario) }}
        />
      </div>

      <p
        className="text-[13px] font-medium text-zinc-900 mb-3 leading-snug"
        dangerouslySetInnerHTML={{ __html: renderConceptText(quiz.question) }}
      />

      <ul className="space-y-2">
        {quiz.options.map((opt, idx) => {
          const isPicked = picked === idx;
          const showResult = answered;
          const correctState =
            showResult && opt.correct
              ? "correct"
              : showResult && isPicked && !opt.correct
                ? "wrong"
                : "idle";
          const borderCls =
            correctState === "correct"
              ? "border-emerald-300 bg-emerald-50"
              : correctState === "wrong"
                ? "border-red-300 bg-red-50"
                : isPicked
                  ? "border-zinc-400 bg-white"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50";
          return (
            <li key={idx}>
              <button
                onClick={() => !answered && onPick(idx)}
                disabled={answered}
                className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors duration-120 ${borderCls} ${
                  answered ? "cursor-default" : "cursor-pointer"
                }`}
              >
                <div className="flex items-start gap-2">
                  {showResult && (
                    <span
                      className={`mt-0.5 text-[12px] font-mono shrink-0 ${
                        opt.correct
                          ? "text-emerald-600"
                          : isPicked
                            ? "text-red-600"
                            : "text-zinc-300"
                      }`}
                    >
                      {opt.correct ? "✓" : isPicked ? "✕" : " "}
                    </span>
                  )}
                  <span
                    className="text-[12.5px] text-zinc-900 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: renderConceptText(opt.label),
                    }}
                  />
                </div>
                {showResult && (isPicked || opt.correct) && (
                  <p
                    className="text-[11.5px] text-zinc-600 mt-1.5 pl-5 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: renderConceptText(opt.explanation),
                    }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-end">
          {hasNext ? (
            <button
              onClick={onNext}
              className="font-mono text-[11px] text-white bg-zinc-900 border border-zinc-900 px-3 py-1.5 rounded-sm cursor-pointer transition-colors duration-120 hover:bg-zinc-800"
            >
              Next quiz →
            </button>
          ) : (
            <button
              onClick={onBack}
              className="font-mono text-[11px] text-zinc-700 bg-white border border-zinc-200 px-3 py-1.5 rounded-sm cursor-pointer transition-colors duration-120 hover:border-zinc-300 hover:bg-zinc-50"
            >
              All quizzes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
