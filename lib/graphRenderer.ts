import type { RepoState } from "./gitState";

// Vivid-but-controlled light-mode palette for branch colors.
const PALETTE = [
  "#0070f3",
  "#00a86b",
  "#e5484d",
  "#d946ef",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
];

// Layout constants — shared with draw().
const ROW = 72;
const COL = 130;
const PL = 72; // pad-left
const PT = 96; // pad-top
const CR = 14; // commit radius

// Persistent branch→color map so colors are stable across redraws.
// Kept module-scoped (matches the original implementation).
const BCC: Record<string, string> = {};
let colorIdx = 0;

export function resetPalette() {
  for (const k of Object.keys(BCC)) delete BCC[k];
  colorIdx = 0;
}

export function branchColor(name: string): string {
  if (BCC[name]) return BCC[name];
  const lo = name.toLowerCase();
  const pre: Record<string, string> = {
    main: "#111111",
    master: "#111111",
    develop: "#0070f3",
    dev: "#0070f3",
  };
  let col = pre[lo] ?? null;
  if (!col) {
    if (lo.startsWith("feature") || lo.startsWith("feat")) col = "#00a86b";
    else if (lo.startsWith("hotfix") || lo.startsWith("fix")) col = "#e5484d";
    else if (lo.startsWith("release")) col = "#8b5cf6";
    else if (lo.startsWith("bugfix")) col = "#f59e0b";
    else {
      col = PALETTE[colorIdx % PALETTE.length];
      colorIdx++;
    }
  }
  BCC[name] = col;
  return col;
}

export function renameBranchColor(oldName: string, newName: string) {
  if (BCC[oldName]) {
    BCC[newName] = BCC[oldName];
    delete BCC[oldName];
  }
}

function buildLayout(S: RepoState) {
  const order: string[] = [];
  S.commits.forEach((c) => {
    if (c.branch && !order.includes(c.branch)) order.push(c.branch);
  });
  Object.keys(S.branches).forEach((b) => {
    if (!order.includes(b)) order.push(b);
  });
  const branchCol: Record<string, number> = {};
  order.forEach((b, i) => (branchCol[b] = i));
  const colOf: Record<string, number> = {};
  S.commits.forEach((c) => {
    colOf[c.id] = (c.branch ? branchCol[c.branch] : undefined) ?? 0;
  });
  const maxCol = Math.max(0, ...Object.values(branchCol));
  return { colOf, branchCol, maxCol };
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export type DrawResult = { commitCount: number };

export function drawGraph(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  S: RepoState,
): DrawResult {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { commitCount: 0 };

  const { colOf, maxCol } = buildLayout(S);
  const rows = S.commits.length;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const W = Math.max(wrap.clientWidth, PL + (maxCol + 1) * COL + 200);
  const H = Math.max(wrap.clientHeight, PT + rows * ROW + 100);

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (!S.inited) {
    ctx.fillStyle = "#d4d4d8";
    ctx.font = "500 13px Geist Mono,monospace";
    ctx.textAlign = "center";
    ctx.fillText("run  git init  to start", W / 2, H / 2);
    return { commitCount: 0 };
  }
  if (!rows) {
    ctx.fillStyle = "#d4d4d8";
    ctx.font = "13px Geist Mono,monospace";
    ctx.textAlign = "center";
    ctx.fillText('no commits yet — try  git commit -m "init"', W / 2, H / 2);
    return { commitCount: 0 };
  }

  const rowOf: Record<string, number> = {};
  S.commits.forEach((c, i) => (rowOf[c.id] = i));
  const cx = (id: string) => PL + (colOf[id] ?? 0) * COL;
  const cy = (id: string) => PT + rowOf[id] * ROW;

  // EDGES — straight when same column, bezier when different.
  S.commits.forEach((c) => {
    c.parents.filter(Boolean).forEach((pid) => {
      const parentId = pid as string;
      if (rowOf[parentId] === undefined) return;
      const x1 = cx(parentId),
        y1 = cy(parentId),
        x2 = cx(c.id),
        y2 = cy(c.id);
      const col = branchColor(c.branch || "main");
      ctx.beginPath();
      ctx.strokeStyle = col + "55";
      ctx.lineWidth = 2;
      if (x1 === x2) {
        ctx.moveTo(x1, y1 + CR);
        ctx.lineTo(x2, y2 - CR);
      } else {
        const my = (y1 + y2) / 2;
        ctx.moveTo(x1, y1 + CR);
        ctx.bezierCurveTo(x1, my, x2, my, x2, y2 - CR);
      }
      ctx.stroke();
    });
  });

  // COMMITS
  S.commits.forEach((c) => {
    const x = cx(c.id),
      y = cy(c.id);
    const isMerge = c.parents.length > 1;
    const col = branchColor(c.branch || "main");
    const isHead = S.detached ? S.HEAD === c.id : S.HEAD ? S.branches[S.HEAD] === c.id : false;

    const ptBranches = Object.entries(S.branches)
      .filter(([, cid]) => cid === c.id)
      .map(([b]) => b);
    const ptTags = Object.entries(S.tags)
      .filter(([, t]) => t.commitId === c.id)
      .map(([n]) => n);

    const labels = [
      ...ptBranches.map((b) => ({
        text: b,
        color: branchColor(b),
        isHead: !S.detached && b === S.HEAD,
      })),
      ...ptTags.map((t) => ({ text: "tag:" + t, color: "#8b5cf6", isHead: false })),
    ];

    // Stacked labels above commit — each in its own row, never overlapping.
    const LH = 20,
      LG = 3;
    const totalLH = labels.length * (LH + LG);
    ctx.font = "600 9px Geist Mono,monospace";

    labels.forEach((lbl, li) => {
      const lx = x;
      const ly = y - CR - 12 - totalLH + li * (LH + LG);
      const text = (lbl.isHead ? "▶ " : "") + lbl.text;
      const tw = ctx.measureText(text).width;
      const pw = tw + 14,
        ph = LH;
      const px = lx - pw / 2,
        py = ly;

      ctx.shadowColor = "rgba(0,0,0,0.08)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      rrect(ctx, px, py, pw, ph, 4);
      ctx.fillStyle = lbl.isHead ? lbl.color : "#ffffff";
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = lbl.isHead ? lbl.color : lbl.color + "60";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = lbl.isHead ? "#ffffff" : lbl.color;
      ctx.textAlign = "center";
      ctx.fillText(text, lx, py + 13.5);

      // Connector dashed line from the bottom-most label to the commit circle.
      if (li === labels.length - 1) {
        ctx.beginPath();
        ctx.strokeStyle = lbl.color + "40";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(lx, py + ph);
        ctx.lineTo(lx, y - CR - 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Detached HEAD annotation floats above the label stack.
    if (S.detached && isHead) {
      const dy = y - CR - (totalLH || 0) - 28;
      ctx.font = "600 9px Geist,sans-serif";
      ctx.fillStyle = "#71717a";
      ctx.textAlign = "center";
      ctx.fillText("HEAD (detached)", x, dy);
    }

    // Glow / shadow for HEAD commit.
    if (isHead) {
      ctx.shadowColor = col + "33";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.arc(x, y, CR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = col + "25";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Circle fill.
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(x, y, CR, 0, Math.PI * 2);
    ctx.fillStyle = isHead ? col : isMerge ? col + "dd" : "#ffffff";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = isHead ? col : col + "aa";
    ctx.lineWidth = isHead ? 0 : 2;
    ctx.stroke();

    // Merge diamond overlay for non-HEAD merge commits.
    if (isMerge && !isHead) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = col + "cc";
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    }

    // Short hash inside circle.
    ctx.font = "600 8px Geist Mono,monospace";
    ctx.fillStyle = isHead ? "rgba(255,255,255,0.9)" : col;
    ctx.textAlign = "center";
    ctx.fillText(c.id.slice(0, 5), x, y + 3.5);

    // Commit message (truncated).
    ctx.font = "500 12.5px Geist,sans-serif";
    ctx.fillStyle = isHead ? "#111111" : "#71717a";
    ctx.textAlign = "left";
    const msg = c.msg.length > 26 ? c.msg.slice(0, 26) + "…" : c.msg;
    ctx.fillText(msg, x + CR + 12, y + 4.5);

    ctx.font = "400 10px Geist Mono,monospace";
    ctx.fillStyle = "#a1a1aa";
    ctx.fillText(c.author || "", x + CR + 12, y + 18);
  });

  return { commitCount: rows };
}
