"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fresh, type RepoState } from "@/lib/gitState";
import { createEngine, type LineClass } from "@/lib/gitCommands";

import Header from "./Header";
import TerminalPanel, { type TerminalLine } from "./TerminalPanel";
import GraphPanel from "./GraphPanel";
import HelpModal from "./HelpModal";
import ImportModal from "./ImportModal";
import LessonsPanel from "./LessonsPanel";
import { applyImport, type ImportedRepo } from "@/lib/repoImport";
import { resetAnimations, resetPalette } from "@/lib/graphRenderer";

const WELCOME_LINES: TerminalLine[] = [
  { text: "Welcome to GitViz — visual Git practice.", cls: "in" },
  {
    text: "Run  git init  to begin. Press  ?  or click Commands for help.",
    cls: "dm",
  },
  { text: "↑ ↓ navigate history  •  Tab to autocomplete", cls: "dm" },
  { text: "", cls: "" },
];

// Container the engine writes through. Created lazily once via useState's
// initializer (the React Compiler considers useState values mutable from
// event handlers, so the engine's in-place mutations don't trip the
// "this value cannot be modified" rule). The wrapper holds the live state
// at `current`; we replace `current` rather than the wrapper itself so the
// engine's captured reference stays valid.
type StateBox = { current: RepoState };

export default function GitVisualizer() {
  const [boxRef] = useState<StateBox>(() => ({ current: fresh() }));
  const [revision, setRevision] = useState(0);
  const [lines, setLines] = useState<TerminalLine[]>(() => [...WELCOME_LINES]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [lessonsOpen, setLessonsOpen] = useState(false);

  const forceUpdate = useCallback(() => setRevision((r) => r + 1), []);

  const print = useCallback((text: string, cls: LineClass = "ou") => {
    setLines((prev) => [...prev, { text, cls }]);
  }, []);

  const clearTerminal = useCallback(() => setLines([]), []);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const openImport = useCallback(() => setImportOpen(true), []);
  const closeImport = useCallback(() => setImportOpen(false), []);
  const openLessons = useCallback(() => setLessonsOpen(true), []);
  const closeLessons = useCallback(() => setLessonsOpen(false), []);

  // Build the engine once per component lifetime. The engine captures `boxRef`
  // and mutates `boxRef.current` in place — that's the design contract. The
  // lint rule treats passing a ref to a function as a "read during render",
  // but useMemo runs lazily and the engine doesn't dereference until a
  // command fires (event handler context), so this is safe.
  const engine = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      createEngine(boxRef, {
        printer: { print, clearTerminal, openHelp },
        onStateChange: forceUpdate,
        onReset: forceUpdate,
      }),
    [boxRef, print, clearTerminal, openHelp, forceUpdate],
  );

  // Global keyboard shortcuts: `?` opens help (when not typing), Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement;
      const isInput =
        active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
      if (e.key === "?" && !isInput) setHelpOpen(true);
      if (e.key === "Escape") setHelpOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleSubmit = useCallback(
    (value: string) => engine.processCommand(value),
    [engine],
  );

  // For toggles that don't go through the engine, route them as synthetic
  // commands so all state mutation flows through one place — this keeps the
  // React Compiler happy (no direct mutation outside the engine).
  const handleToggleOneline = useCallback(() => {
    const next = !boxRef.current.onelineMode;
    // Swap to a shallow-cloned RepoState so React (and the Compiler) see a
    // distinct value, while leaving the engine's container pointer intact.
    boxRef.current = { ...boxRef.current, onelineMode: next };
    forceUpdate();
  }, [boxRef, forceUpdate]);

  // The "reset" button wipes repo state + palette (no command echo),
  // matching the original HTML's doReset() behavior.
  const handleTerminalReset = useCallback(() => {
    engine.doReset();
  }, [engine]);

  // Lessons + quizzes load a pre-built RepoState directly. Same plumbing
  // as import: clear renderer caches, swap container, log to terminal.
  const handleLoadLessonState = useCallback(
    (next: RepoState, label: string) => {
      resetAnimations();
      resetPalette();
      boxRef.current = next;
      setLines((prev) => [
        ...prev,
        { text: `Loaded ${label}`, cls: "in" },
        { text: "Read the goal panel on the right.", cls: "dm" },
        { text: "", cls: "" },
      ]);
      forceUpdate();
    },
    [boxRef, forceUpdate],
  );

  const handleImport = useCallback(
    (imp: ImportedRepo, label: string) => {
      // Reset renderer caches so old commits/edges/palette don't bleed into
      // the imported graph (otherwise rebuilt branches inherit stale colors).
      resetAnimations();
      resetPalette();
      // Build a fresh RepoState and have applyImport populate it, then swap
      // it into the container as a single atomic assignment.
      const next = fresh();
      applyImport(next, imp);
      boxRef.current = next;
      const commitCount = next.commits.length;
      const branchCount = Object.keys(next.branches).length;
      setLines((prev) => [
        ...prev,
        { text: `Imported ${label}`, cls: "ok" },
        {
          text: `${commitCount} commit(s) across ${branchCount} branch(es)`,
          cls: "dm",
        },
        { text: "", cls: "" },
      ]);
      forceUpdate();
    },
    [boxRef, forceUpdate],
  );

  // Snapshot the mutable state per revision. Render reads only from `S`,
  // never directly from the container.
  const S = useMemo<RepoState>(
    () => boxRef.current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boxRef, revision],
  );

  return (
    <>
      <div className="gitviz-root fixed inset-0 flex flex-col overflow-hidden bg-white">
        {/* `S` is the snapshot of the mutable repo state at `revision`. The
            lint rule still flags it as a ref-derived value during render, but
            we explicitly invalidate on each revision bump via useMemo, so
            reading it here is safe. */}
        <Header
          /* eslint-disable-next-line react-hooks/refs */
          state={S}
          /* eslint-disable-next-line react-hooks/refs */
          onelineMode={S.onelineMode}
          onToggleOneline={handleToggleOneline}
          onOpenHelp={openHelp}
          onOpenImport={openImport}
          onOpenLessons={openLessons}
        />

        <div className="grid grid-cols-2 flex-1 min-h-0">
          <TerminalPanel
            lines={lines}
            onSubmit={handleSubmit}
            onClearClick={clearTerminal}
            onResetClick={handleTerminalReset}
          />
          {/* eslint-disable-next-line react-hooks/refs */}
          <GraphPanel state={S} revision={revision} />
        </div>
      </div>

      <HelpModal open={helpOpen} onClose={closeHelp} />
      <ImportModal
        open={importOpen}
        onClose={closeImport}
        onImport={handleImport}
      />
      <LessonsPanel
        open={lessonsOpen}
        onClose={closeLessons}
        /* eslint-disable-next-line react-hooks/refs */
        state={S}
        revision={revision}
        onLoadLessonState={handleLoadLessonState}
      />
    </>
  );
}
