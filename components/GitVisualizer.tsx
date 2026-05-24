"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fresh, type RepoState } from "@/lib/gitState";
import { createEngine, type LineClass } from "@/lib/gitCommands";

import Header from "./Header";
import TerminalPanel, { type TerminalLine } from "./TerminalPanel";
import GraphPanel from "./GraphPanel";
import HelpModal from "./HelpModal";
import ImportModal from "./ImportModal";
import { applyImport, type ImportedRepo } from "@/lib/repoImport";
import { resetAnimations, resetPalette } from "@/lib/graphRenderer";

export default function GitVisualizer() {
  // Mutable repo state lives in a ref — commands mutate it in place,
  // and we bump `revision` to tell React to rerender consumers.
  const stateRef = useRef<RepoState>(fresh());
  const [revision, setRevision] = useState(0);

  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const forceUpdate = useCallback(() => setRevision((r) => r + 1), []);

  const print = useCallback((text: string, cls: LineClass = "ou") => {
    setLines((prev) => [...prev, { text, cls }]);
  }, []);

  const clearTerminal = useCallback(() => setLines([]), []);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  // Build the engine once. Setter references from useState/useCallback are stable,
  // so it's safe to capture them in the closure.
  const engine = useMemo(
    () =>
      createEngine(stateRef, {
        printer: {
          print,
          clearTerminal,
          openHelp,
        },
        onStateChange: forceUpdate,
        onReset: forceUpdate,
      }),
    [print, clearTerminal, openHelp, forceUpdate],
  );

  // One-time welcome banner.
  useEffect(() => {
    print("Welcome to GitViz — visual Git practice.", "in");
    print(
      "Run  git init  to begin. Press  ?  or click Commands for help.",
      "dm",
    );
    print("↑ ↓ navigate history  •  Tab to autocomplete", "dm");
    print("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global keyboard shortcuts: `?` opens help (when not typing), Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement;
      const isInput =
        active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
      if (e.key === "?" && !isInput) {
        setHelpOpen(true);
      }
      if (e.key === "Escape") {
        setHelpOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleSubmit = useCallback(
    (value: string) => engine.processCommand(value),
    [engine],
  );

  const handleToggleOneline = useCallback(() => {
    stateRef.current.onelineMode = !stateRef.current.onelineMode;
    forceUpdate();
  }, [forceUpdate]);

  // The "reset" button wipes repo state + palette (no command echo),
  // matching the original HTML's doReset() behavior.
  const handleTerminalReset = useCallback(() => {
    engine.doReset();
  }, [engine]);

  const openImport = useCallback(() => setImportOpen(true), []);
  const closeImport = useCallback(() => setImportOpen(false), []);

  const handleImport = useCallback(
    (imp: ImportedRepo, label: string) => {
      // Reset renderer caches so old commits/edges/palette don't bleed into
      // the imported graph (otherwise rebuilt branches inherit stale colors).
      resetAnimations();
      resetPalette();
      applyImport(stateRef.current, imp);
      setLines((prev) => [
        ...prev,
        { text: `Imported ${label}`, cls: "ok" },
        {
          text: `${stateRef.current.commits.length} commit(s) across ${
            Object.keys(stateRef.current.branches).length
          } branch(es)`,
          cls: "dm",
        },
        { text: "", cls: "" },
      ]);
      forceUpdate();
    },
    [forceUpdate],
  );

  const S = stateRef.current;

  return (
    <>
      <div className="gitviz-root fixed inset-0 flex flex-col overflow-hidden bg-white">
        <Header
          state={S}
          onelineMode={S.onelineMode}
          onToggleOneline={handleToggleOneline}
          onOpenHelp={openHelp}
          onOpenImport={openImport}
        />

        <div className="grid grid-cols-2 flex-1 min-h-0">
          <TerminalPanel
            lines={lines}
            onSubmit={handleSubmit}
            onClearClick={clearTerminal}
            onResetClick={handleTerminalReset}
          />
          <GraphPanel state={S} revision={revision} />
        </div>
      </div>

      <HelpModal open={helpOpen} onClose={closeHelp} />
      <ImportModal
        open={importOpen}
        onClose={closeImport}
        onImport={handleImport}
      />
    </>
  );
}
