"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { LineClass } from "@/lib/gitCommands";
import { CMDS } from "@/lib/commandList";

export type TerminalLine = { text: string; cls: LineClass };

type Props = {
  lines: TerminalLine[];
  onSubmit: (value: string) => void;
  onClearClick: () => void;
  onResetClick: () => void;
};

export default function TerminalPane({
  lines,
  onSubmit,
  onClearClick,
  onResetClick,
}: Props) {
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);

  // Autocomplete state.
  const [acVis, setAcVis] = useState<string[]>([]);
  const [acSel, setAcSel] = useState(-1);

  // Auto-scroll terminal to bottom whenever lines change.
  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Focus the input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Dismiss autocomplete when clicking outside the input + popup.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        !inputRef.current?.contains(t) &&
        !acRef.current?.contains(t)
      ) {
        setAcVis([]);
        setAcSel(-1);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function updateAC(v: string) {
    if (!v) {
      setAcVis([]);
      setAcSel(-1);
      return;
    }
    const m = CMDS.filter((c) => c.startsWith(v) && c.trim() !== v.trim()).slice(0, 7);
    setAcVis(m);
    setAcSel(-1);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    updateAC(v);
  }

  function submit(v: string) {
    if (v.trim()) {
      setHistory((h) => [v, ...h]);
    }
    setHistIdx(-1);
    setAcVis([]);
    setAcSel(-1);
    onSubmit(v);
    setValue("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    const acOpen = acVis.length > 0;

    if (acOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAcSel((s) => (s + 1) % acVis.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAcSel((s) => (s - 1 + acVis.length) % acVis.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && acSel >= 0)) {
        e.preventDefault();
        const pick = acVis[acSel >= 0 ? acSel : 0];
        if (pick) setValue(pick.trimEnd());
        setAcVis([]);
        setAcSel(-1);
        return;
      }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (acVis[0]) setValue(acVis[0].trimEnd());
      setAcVis([]);
      setAcSel(-1);
      return;
    }

    if (e.key === "Enter") {
      submit(value);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx < history.length - 1) {
        const next = histIdx + 1;
        setHistIdx(next);
        const nv = history[next];
        setValue(nv);
        updateAC(nv);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx > 0) {
        const next = histIdx - 1;
        setHistIdx(next);
        const nv = history[next];
        setValue(nv);
        updateAC(nv);
      } else {
        setHistIdx(-1);
        setValue("");
        updateAC("");
      }
      return;
    }

    if (e.key === "Escape") {
      setAcVis([]);
      setAcSel(-1);
    }
  }

  return (
    <div className="pane pane-terminal">
      <div className="pane-bar pane-bar-terminal">
        <div className="pane-bar-left">
          <div className="mac-dots">
            <div className="mac-dot mac-dot-r" />
            <div className="mac-dot mac-dot-y" />
            <div className="mac-dot mac-dot-g" />
          </div>
          <span className="pane-title pane-title-terminal">terminal</span>
        </div>
        <div className="pane-bar-right">
          <button className="pbar-btn" onClick={onClearClick}>
            clear
          </button>
          <button className="pbar-btn" onClick={onResetClick}>
            reset
          </button>
        </div>
      </div>

      <div className="terminal" ref={termRef}>
        {lines.map((ln, i) =>
          ln.text === "" ? (
            <div key={i} style={{ height: 6 }} />
          ) : (
            <div key={i} className={"line " + ln.cls}>
              {ln.text}
            </div>
          ),
        )}
      </div>

      <div className="input-wrap">
        <div
          className="autocomplete"
          ref={acRef}
          style={{ display: acVis.length ? "block" : "none" }}
        >
          {acVis.map((c, i) => (
            <div
              key={c + i}
              className={"ac-item" + (i === acSel ? " selected" : "")}
              onClick={() => {
                setValue(c.trimEnd());
                setAcVis([]);
                setAcSel(-1);
                inputRef.current?.focus();
              }}
            >
              <em>{value}</em>
              <span className="ac-item-rest">{c.slice(value.length)}</span>
            </div>
          ))}
          {acVis.length > 0 && (
            <div className="ac-hint">↑↓ navigate • Tab/Enter select • Esc close</div>
          )}
        </div>
        <div className="input-row">
          <span className="psym">›</span>
          <input
            id="cinput"
            ref={inputRef}
            type="text"
            placeholder="git init"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKey}
          />
        </div>
      </div>

      <div className="hint-bar">
        <span className="hint-item">
          <span className="k">↑↓</span> history
        </span>
        <span className="hint-item">
          <span className="k">Tab</span> autocomplete
        </span>
        <span className="hint-item">
          <span className="k">?</span> commands
        </span>
        <span className="hint-item">
          <span className="k">Esc</span> dismiss
        </span>
      </div>
    </div>
  );
}
