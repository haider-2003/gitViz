"use client";

import { Fragment } from "react";
import { HELP_SECTIONS, type HelpCmd } from "@/lib/commandList";

type Props = {
  open: boolean;
  onClose: () => void;
};

// The command strings use {braces} to mark accent-colored spans (blue).
// This mirrors the <span> markup in the original HTML.
function renderCode(code: string) {
  const parts: React.ReactNode[] = [];
  let i = 0,
    key = 0;
  while (i < code.length) {
    const open = code.indexOf("{", i);
    if (open === -1) {
      parts.push(code.slice(i));
      break;
    }
    const close = code.indexOf("}", open + 1);
    if (close === -1) {
      parts.push(code.slice(i));
      break;
    }
    if (open > i) parts.push(code.slice(i, open));
    parts.push(
      <span key={key++} className="text-blue-500">
        {code.slice(open + 1, close)}
      </span>,
    );
    i = close + 1;
  }
  return parts;
}

function Cell({ cmd, isRight }: { cmd: HelpCmd; isRight?: boolean }) {
  return (
    <div
      className={`py-2.25 ${isRight ? "border-l border-zinc-100 pl-5" : ""}`}
    >
      <code className="font-mono text-[11.5px] font-medium text-zinc-800 block">
        {renderCode(cmd.code)}
      </code>
      <span className="font-sans text-[11.5px] text-zinc-400 mt-0.5 block leading-[1.4]">
        {cmd.desc}
      </span>
    </div>
  );
}

export default function HelpModal({ open, onClose }: Props) {
  return (
    <div
      className={`fixed inset-0 z-200 bg-black/30 backdrop-blur-md flex items-center justify-center transition-opacity duration-180 ${
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white border border-zinc-200 rounded-[10px] w-[min(740px,94vw)] max-h-[86vh] overflow-hidden flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] [transition:transform_0.2s_cubic-bezier(0.16,1,0.3,1),opacity_0.18s] ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-[0.99] opacity-0"
        }`}
      >
        {/* Modal header */}
        <div className="px-6 pt-5 pb-4 border-b border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50">
          <div>
            <div className="text-[13px] font-semibold text-zinc-900">
              Command Reference
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">
              50+ git commands supported
            </div>
          </div>
          <button
            className="w-7 h-7 rounded-sm bg-transparent border border-zinc-200 text-zinc-400 cursor-pointer flex items-center justify-center text-sm transition-all duration-120 hover:bg-zinc-100 hover:text-zinc-700 hover:border-zinc-300"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1 scrollbar-light">
          {HELP_SECTIONS.map((section) => (
            <Fragment key={section.label}>
              <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-zinc-400 px-6 py-3.5 pb-2 sticky top-0 bg-white border-b border-zinc-100 z-1 font-sans">
                {section.label}
              </div>
              {section.rows.map((row, ri) => (
                <div
                  key={ri}
                  className="grid grid-cols-2 px-6 border-b border-zinc-100 last:border-b-0"
                >
                  <Cell cmd={row[0]} />
                  <Cell cmd={row[1]} isRight />
                </div>
              ))}
            </Fragment>
          ))}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
