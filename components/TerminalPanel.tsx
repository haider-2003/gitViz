"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { LineClass } from "@/lib/gitCommands";
import { CMDS } from "@/lib/commandList";

export type TerminalLine = { text: string; cls: LineClass };

/** Maps each LineClass token to Tailwind text-color (+ optional style) utilities. */
const LINE_COLORS: Record<string, string> = {
  p: "text-blue-400",
  ok: "text-green-400",
  er: "text-red-400",
  in: "text-cyan-300",
  wn: "text-amber-400",
  dm: "text-zinc-700 italic",
  ou: "text-zinc-500",
  hl: "text-purple-400",
  sep: "text-zinc-800 tracking-widest",
  "": "text-zinc-500",
};

type Props = {
  lines: TerminalLine[];
  onSubmit: (value: string) => void;
  onClearClick: () => void;
  onResetClick: () => void;
};

export default function TerminalPanel({
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
      if (!inputRef.current?.contains(t) && !acRef.current?.contains(t)) {
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
    const m = CMDS.filter(
      (c) => c.startsWith(v) && c.trim() !== v.trim(),
    ).slice(0, 7);
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
    <div className="overflow-hidden flex flex-col relative bg-[#0a0a0b]">
      {/* ── Panel bar ── */}
      <div className="h-9 flex items-center justify-between px-4 shrink-0 bg-[#0f0f11] border-b border-[#1f1f23]">
        <div className="flex items-center gap-1.75">
          {/* macOS-style traffic lights */}
          <div className="flex gap-1.25 items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] font-medium tracking-[0.06em] uppercase font-mono text-zinc-600">
            terminal
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            className="font-mono text-[10px] text-zinc-600 bg-transparent border border-[#2a2a2e] px-2 py-0.5 rounded-[3px] cursor-pointer transition-all duration-120 hover:text-zinc-400 hover:border-zinc-700"
            onClick={onClearClick}
          >
            clear
          </button>
          <button
            className="font-mono text-[10px] text-zinc-600 bg-transparent border border-[#2a2a2e] px-2 py-0.5 rounded-[3px] cursor-pointer transition-all duration-120 hover:text-zinc-400 hover:border-zinc-700"
            onClick={onResetClick}
          >
            reset
          </button>
        </div>
      </div>

      {/* ── Terminal output ── */}
      <div
        ref={termRef}
        className="flex-1 overflow-y-auto py-4 px-4.5 pb-2 font-mono bg-[#0a0a0b] scrollbar-dark"
      >
        {lines.map((ln, i) =>
          ln.text === "" ? (
            <div key={i} style={{ height: 6 }} />
          ) : (
            <div
              key={i}
              className={`text-[12.5px] leading-[1.8] whitespace-pre-wrap break-all ${LINE_COLORS[ln.cls] ?? "text-zinc-500"}`}
            >
              {ln.cls === "p" && (
                <span className="text-green-400 font-semibold">$ </span>
              )}
              {ln.text}
            </div>
          ),
        )}
      </div>

      {/* ── Input area ── */}
      <div className="relative shrink-0">
        {/* Autocomplete dropdown */}
        <div
          ref={acRef}
          className="absolute bottom-full left-0 right-0 z-50 bg-[#111114] border border-[#2a2a2e] border-b-0 rounded-t-md overflow-hidden shadow-[0_-8px_24px_rgba(0,0,0,0.4)]"
          style={{ display: acVis.length ? "block" : "none" }}
        >
          {acVis.map((c, i) => (
            <div
              key={c + i}
              className={`px-4 py-1.75 font-mono text-[11.5px] cursor-pointer flex items-center gap-1.5 transition-colors duration-80 ${
                i === acSel
                  ? "bg-[#1a1a1f] text-zinc-400"
                  : "text-zinc-600 hover:bg-[#1a1a1f] hover:text-zinc-400"
              }`}
              onClick={() => {
                setValue(c.trimEnd());
                setAcVis([]);
                setAcSel(-1);
                inputRef.current?.focus();
              }}
            >
              <em className="text-blue-400 not-italic font-medium">{value}</em>
              <span className="text-zinc-700">{c.slice(value.length)}</span>
            </div>
          ))}
          {acVis.length > 0 && (
            <div className="px-4 py-1.25 text-[10px] text-[#2a2a2e] border-t border-[#1a1a1f] font-mono">
              ↑↓ navigate • Tab/Enter select • Esc close
            </div>
          )}
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-t border-[#1f1f23] bg-[#0d0d10]">
          <span className="font-mono text-[13px] font-semibold text-green-400 shrink-0 select-none">
            ›
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="git init"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKey}
            className="flex-1 bg-transparent border-0 outline-none font-mono text-[12.5px] text-zinc-200 caret-green-400 placeholder:text-zinc-700"
          />
        </div>
      </div>

      {/* ── Hint bar ── */}
      <div className="px-4 py-1.25 bg-[#080809] border-t border-[#141416] flex gap-4 shrink-0">
        {(
          [
            ["↑↓", "history"],
            ["Tab", "autocomplete"],
            ["?", "commands"],
            ["Esc", "dismiss"],
          ] as const
        ).map(([key, label]) => (
          <span
            key={key}
            className="flex items-center gap-1.25 font-mono text-[10px] text-zinc-700"
          >
            <span className="bg-[#1a1a1f] border border-[#2a2a2e] border-b-2 text-zinc-600 px-1.25 rounded-[3px] text-[9px]">
              {key}
            </span>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
