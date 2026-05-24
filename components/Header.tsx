"use client";

import type { RepoState } from "@/lib/gitState";

type HeaderProps = {
  state: RepoState;
  onelineMode: boolean;
  onToggleOneline: () => void;
  onOpenHelp: () => void;
  onOpenImport: () => void;
  onOpenLessons: () => void;
};

export default function Header({
  state,
  onelineMode,
  onToggleOneline,
  onOpenHelp,
  onOpenImport,
  onOpenLessons,
}: HeaderProps) {
  const dotCls = !state.inited
    ? "bg-zinc-300"
    : state.detached
      ? "bg-amber-400"
      : "bg-[#00a86b] shadow-[0_0_0_2px_rgba(0,168,107,0.2)]";

  const branchLabel = !state.inited
    ? "not initialized"
    : state.detached
      ? "detached:" + (state.HEAD?.slice(0, 7) ?? "")
      : state.HEAD || "—";

  const hasStaged = state.staged.length > 0;

  return (
    <header className="h-13 bg-white/85 backdrop-blur-md border-b border-zinc-200 flex items-center justify-between px-5 relative z-30 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 font-mono font-semibold text-sm text-zinc-950 tracking-tight">
        <div className="w-6 h-6 bg-zinc-950 rounded-[5px] flex items-center justify-center shrink-0">
          <svg
            viewBox="0 0 16 16"
            className="w-3.25 h-3.25 fill-none stroke-white stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
          >
            <circle cx="4" cy="4" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="4" r="2" />
            <line x1="4" y1="6" x2="4" y2="12" />
            <line x1="6" y1="4" x2="10" y2="4" />
            <line x1="12" y1="6" x2="12" y2="10" />
          </svg>
        </div>
        GitViz
        <span className="text-zinc-300 mx-0.5">/</span>
        <span className="text-zinc-400 font-normal">practice</span>
      </div>

      {/* Center — branch tag + staged chip */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.25 font-mono text-[11.5px] font-medium bg-zinc-100 border border-zinc-200 text-zinc-700 px-2.5 py-0.75 rounded-full transition-all duration-150">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
          <span>{branchLabel}</span>
        </div>
        {hasStaged && (
          <div className="flex items-center gap-1 font-mono text-[10.5px] font-medium bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
            <span className="text-[8px] text-amber-500">●</span>
            staged changes
          </div>
        )}
      </div>

      {/* Right — action buttons */}
      <div className="flex items-center gap-1.5">
        <button
          className="font-mono text-[11px] font-normal text-white bg-zinc-900 border border-zinc-900 px-2.75 py-1 rounded-sm cursor-pointer transition-colors duration-120 whitespace-nowrap hover:bg-zinc-800"
          onClick={onOpenLessons}
          title="Lessons and quizzes — guided git practice"
        >
          Learn
        </button>
        <button
          className="font-mono text-[11px] font-normal text-zinc-500 bg-transparent border border-zinc-200 px-2.75 py-1 rounded-sm cursor-pointer transition-all duration-120 whitespace-nowrap hover:text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
          onClick={onOpenImport}
          title="Import a public repo or paste git log output"
        >
          Import repo
        </button>
        <button
          className={`font-mono text-[11px] font-normal border px-2.75 py-1 rounded-sm cursor-pointer transition-all duration-120 whitespace-nowrap hover:text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 ${
            onelineMode
              ? "text-blue-600 border-blue-200 bg-blue-50"
              : "text-zinc-500 border-zinc-200 bg-transparent"
          }`}
          onClick={onToggleOneline}
        >
          --oneline
        </button>
        <button
          className="font-mono text-[11px] font-normal text-zinc-500 bg-transparent border border-zinc-200 px-2.75 py-1 rounded-sm cursor-pointer transition-all duration-120 whitespace-nowrap hover:text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
          onClick={onOpenHelp}
        >
          Commands
          <span className="inline-flex items-center font-mono text-[10px] bg-zinc-100 border border-zinc-200 border-b-2 text-zinc-500 px-1.25 py-px rounded-[3px] ml-1.5">
            ?
          </span>
        </button>
      </div>
    </header>
  );
}
