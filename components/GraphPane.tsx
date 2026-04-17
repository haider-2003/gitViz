"use client";

import { useEffect, useRef, useState } from "react";
import { drawGraph } from "@/lib/graphRenderer";
import type { RepoState } from "@/lib/gitState";

type Props = {
  state: RepoState;
  // Incremented by the parent on every state mutation to trigger a redraw.
  revision: number;
};

export default function GraphPane({ state, revision }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);

  // Redraw when state changes or container resizes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const render = () => {
      const res = drawGraph(canvas, wrap, state);
      setCount(res.commitCount);
    };
    render();

    const ro = new ResizeObserver(render);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [state, revision]);

  return (
    <div className="pane pane-graph divider">
      <div className="pane-bar pane-bar-graph">
        <div className="pane-bar-left">
          <span className="pane-title pane-title-graph">Graph</span>
        </div>
        <div
          id="commit-count"
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--gray-400)",
          }}
        >
          {count > 0 ? `${count} commit${count !== 1 ? "s" : ""}` : ""}
        </div>
      </div>
      <div className="graph-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} id="gcanvas" />
      </div>
    </div>
  );
}
