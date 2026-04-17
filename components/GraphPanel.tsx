"use client";

import { useEffect, useRef, useState } from "react";
import { drawGraph, cancelGraphAnimation } from "@/lib/graphRenderer";
import type { RepoState } from "@/lib/gitState";

type Props = {
  state: RepoState;
  // Incremented by the parent on every state mutation to trigger a redraw.
  revision: number;
};

export default function GraphPanel({ state, revision }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);

  // Redraw when state changes or container resizes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let lastW = 0;
    let lastH = 0;

    const render = () => {
      const res = drawGraph(canvas, wrap, state);
      setCount(res.commitCount);
    };
    render();
    lastW = wrap.clientWidth;
    lastH = wrap.clientHeight;

    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      render();
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      cancelGraphAnimation();
    };
  }, [state, revision]);

  return (
    <div className="overflow-hidden flex flex-col relative bg-white border-l border-zinc-200">
      {/* ── Panel bar ── */}
      <div className="h-9 flex items-center justify-between px-4 shrink-0 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-1.75">
          <span className="text-[11px] font-medium tracking-[0.06em] uppercase font-sans text-zinc-400">
            Graph
          </span>
        </div>
        {count > 0 && (
          <span className="text-[11px] font-mono text-zinc-400">
            {count} commit{count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Canvas wrapper ── */}
      <div
        ref={wrapRef}
        className="flex-1 overflow-auto relative bg-white scrollbar-graph bg-[radial-gradient(circle,#d4d4d8_1px,transparent_1px)] bg-size-[22px_22px]"
      >
        <canvas ref={canvasRef} className="block relative z-1" />
      </div>
    </div>
  );
}
