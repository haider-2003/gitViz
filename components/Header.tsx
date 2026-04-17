"use client";

import type { RepoState } from "@/lib/gitState";

type HeaderProps = {
  state: RepoState;
  onelineMode: boolean;
  onToggleOneline: () => void;
  onOpenHelp: () => void;
};

export default function Header({
  state,
  onelineMode,
  onToggleOneline,
  onOpenHelp,
}: HeaderProps) {
  let branchLabel = "not initialized";
  let branchClass = "branch-tag empty";

  if (state.inited) {
    if (state.detached) {
      branchLabel = "detached:" + (state.HEAD?.slice(0, 7) ?? "");
      branchClass = "branch-tag detached";
    } else {
      branchLabel = state.HEAD || "—";
      branchClass = "branch-tag";
    }
  }

  const hasStaged = state.staged.length > 0;

  return (
    <header>
      <div className="logo">
        <div className="logo-icon">
          <svg viewBox="0 0 16 16">
            <circle cx="4" cy="4" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="4" r="2" />
            <line x1="4" y1="6" x2="4" y2="12" />
            <line x1="6" y1="4" x2="10" y2="4" />
            <line x1="12" y1="6" x2="12" y2="10" />
          </svg>
        </div>
        GitViz
        <span className="logo-sep">/</span>
        <span style={{ color: "var(--gray-400)", fontWeight: 400 }}>practice</span>
      </div>

      <div className="header-mid">
        <div className={branchClass}>
          <span className="b-dot" />
          <span>{branchLabel}</span>
        </div>
        {hasStaged && <div className="staged-chip">staged changes</div>}
      </div>

      <div className="header-right">
        <button
          className={"hbtn" + (onelineMode ? " active" : "")}
          onClick={onToggleOneline}
        >
          --oneline
        </button>
        <button className="hbtn" onClick={onOpenHelp}>
          Commands
          <span className="kbd">?</span>
        </button>
      </div>
    </header>
  );
}
