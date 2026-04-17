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
    parts.push(<span key={key++}>{code.slice(open + 1, close)}</span>);
    i = close + 1;
  }
  return parts;
}

function Cell({ cmd }: { cmd: HelpCmd }) {
  return (
    <div className="cmd-cell">
      <code className="cmd-code">{renderCode(cmd.code)}</code>
      <span className="cmd-desc">{cmd.desc}</span>
    </div>
  );
}

export default function HelpModal({ open, onClose }: Props) {
  return (
    <div
      className={"overlay" + (open ? " open" : "")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Command Reference</div>
            <div className="modal-subtitle">50+ git commands supported</div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {HELP_SECTIONS.map((section) => (
            <Fragment key={section.label}>
              <div className="cmd-section-label">{section.label}</div>
              {section.rows.map((row, ri) => (
                <div className="cmd-row" key={ri}>
                  <Cell cmd={row[0]} />
                  <Cell cmd={row[1]} />
                </div>
              ))}
            </Fragment>
          ))}
          <div style={{ height: 16 }} />
        </div>
      </div>
    </div>
  );
}
