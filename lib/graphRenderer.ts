import type { RepoState } from "./gitState";

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

const ROW = 80;
const COL = 140;
const PT = 100;
const CR = 16;

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

// ─── ANIMATION SYSTEM ──────────────────────────────────────
type AnimationType = "commit" | "edge" | "merge-edge";
interface Animation {
  type: AnimationType;
  key: string;
  progress: number;
  startTime: number;
  duration: number;
}

const ANIM_DURATION_COMMIT = 400;
const ANIM_DURATION_EDGE = 350;
const ANIM_DURATION_MERGE = 500;

let knownCommits = new Set<string>();
let knownEdges = new Set<string>();
let animations: Animation[] = [];
let rafHandle: number | null = null;

function edgeKey(parentId: string, childId: string) {
  return `${parentId}->${childId}`;
}

function easeOut(t: number) {
  const t1 = 1 - t;
  return 1 - t1 * t1 * t1;
}

function startAnim(type: AnimationType, key: string, now: number) {
  if (animations.find((a) => a.key === key)) return;
  const duration =
    type === "commit"
      ? ANIM_DURATION_COMMIT
      : type === "merge-edge"
        ? ANIM_DURATION_MERGE
        : ANIM_DURATION_EDGE;
  animations.push({ type, key, progress: 0, startTime: now, duration });
}

function tickAnimations(now: number): boolean {
  let anyRunning = false;
  for (const a of animations) {
    const elapsed = now - a.startTime;
    a.progress = Math.min(1, elapsed / a.duration);
    if (a.progress < 1) anyRunning = true;
  }
  animations = animations.filter((a) => a.progress < 1);
  return anyRunning;
}

function getAnimProgress(key: string): number {
  const anim = animations.find((a) => a.key === key);
  if (!anim) return 1;
  return easeOut(anim.progress);
}

export function resetAnimations() {
  knownCommits = new Set();
  knownEdges = new Set();
  animations = [];
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
}

export function cancelGraphAnimation() {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
}

// ─── LAYOUT ────────────────────────────────────────────────
function buildLayout(S: RepoState) {
  // Main/master is always column 0 (center).
  const mainName =
    ["main", "master"].find((b) => b in S.branches) ||
    (S.commits.length > 0 ? S.commits[0].branch : null);

  // Row ranges per branch: first commit → last relevant row.
  const branchFirstRow: Record<string, number> = {};
  const branchEndRow: Record<string, number> = {};
  const mergedBranches = new Set<string>();

  S.commits.forEach((c, i) => {
    if (!c.branch) return;
    if (!(c.branch in branchFirstRow)) branchFirstRow[c.branch] = i;
    branchEndRow[c.branch] = i;
  });

  // When a merge commit references another branch's commit as a non-first
  // parent, that branch is "merged" and its lane ends at the merge row.
  S.commits.forEach((c, i) => {
    if (c.parents.length <= 1) return;
    for (let pi = 1; pi < c.parents.length; pi++) {
      const pid = c.parents[pi];
      if (!pid) continue;
      const parent = S.commits.find((p) => p.id === pid);
      if (parent?.branch && parent.branch !== c.branch) {
        mergedBranches.add(parent.branch);
        branchEndRow[parent.branch] = Math.max(
          branchEndRow[parent.branch] ?? i,
          i,
        );
      }
    }
  });

  // Non-merged, still-existing branches occupy their lane indefinitely.
  for (const b of Object.keys(branchFirstRow)) {
    if (!mergedBranches.has(b) && b in S.branches) {
      branchEndRow[b] = Infinity;
    }
  }
  if (mainName && mainName in branchFirstRow) {
    branchEndRow[mainName] = Infinity;
  }

  // ── Column assignment: main at 0, others symmetrically ±1, ±2… ──
  const branchCol: Record<string, number> = {};
  if (mainName) branchCol[mainName] = 0;

  const allocations: { col: number; startRow: number; endRow: number }[] = [];
  if (mainName && mainName in branchFirstRow) {
    allocations.push({ col: 0, startRow: 0, endRow: Infinity });
  }

  function isColFreeInRange(
    col: number,
    startRow: number,
    endRow: number,
  ): boolean {
    return !allocations.some(
      (a) => a.col === col && a.endRow >= startRow && a.startRow <= endRow,
    );
  }

  const otherBranches = Object.keys(branchFirstRow)
    .filter((b) => b !== mainName)
    .sort((a, b) => branchFirstRow[a] - branchFirstRow[b]);

  for (const b of otherBranches) {
    const startRow = branchFirstRow[b];
    const endRow = branchEndRow[b];

    // Try +1, -1, +2, -2, … to distribute symmetrically & reuse freed lanes.
    let bestCol: number | null = null;
    for (let dist = 1; dist <= 20; dist++) {
      if (isColFreeInRange(dist, startRow, endRow)) {
        bestCol = dist;
        break;
      }
      if (isColFreeInRange(-dist, startRow, endRow)) {
        bestCol = -dist;
        break;
      }
    }
    if (bestCol === null) bestCol = allocations.length + 1;

    branchCol[b] = bestCol;
    allocations.push({ col: bestCol, startRow, endRow });
  }

  // Branches with no commits yet.
  Object.keys(S.branches).forEach((b) => {
    if (!(b in branchCol)) branchCol[b] = 0;
  });

  const colOf: Record<string, number> = {};
  S.commits.forEach((c) => {
    colOf[c.id] = (c.branch ? branchCol[c.branch] : undefined) ?? 0;
  });

  const allCols = Object.values(branchCol);
  const minCol = Math.min(0, ...allCols);
  const maxCol = Math.max(0, ...allCols);

  return { colOf, branchCol, minCol, maxCol };
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawPartialBezier(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x3: number,
  y3: number,
  t: number,
) {
  const ax = x0 + (cx1 - x0) * t;
  const ay = y0 + (cy1 - y0) * t;
  const bx = cx1 + (cx2 - cx1) * t;
  const by = cy1 + (cy2 - cy1) * t;
  const pcx = cx2 + (x3 - cx2) * t;
  const pcy = cy2 + (y3 - cy2) * t;
  const dx = ax + (bx - ax) * t;
  const dy = ay + (by - ay) * t;
  const ex = bx + (pcx - bx) * t;
  const ey = by + (pcy - by) * t;
  const fx = dx + (ex - dx) * t;
  const fy = dy + (ey - dy) * t;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(ax, ay, dx, dy, fx, fy);
}

// ─── MAIN DRAW ─────────────────────────────────────────────
export type DrawResult = { commitCount: number };

export function drawGraph(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  S: RepoState,
): DrawResult {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }

  const ctx = canvas.getContext("2d")!;
  if (!ctx) return { commitCount: 0 };

  const { colOf, minCol, maxCol } = buildLayout(S);
  const rows = S.commits.length;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const treeWidth = (maxCol - minCol) * COL;
  const W = Math.max(wrap.clientWidth, treeWidth + 500);
  const H = Math.max(wrap.clientHeight, PT + rows * ROW + 100);

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";

  if (!S.inited) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#d4d4d8";
    ctx.font = "500 13px Geist Mono,monospace";
    ctx.textAlign = "center";
    ctx.fillText("run  git init  to start", W / 2, H / 2);
    return { commitCount: 0 };
  }
  if (!rows) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#d4d4d8";
    ctx.font = "13px Geist Mono,monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      'no commits yet \u2014 try  git commit -m "init"',
      W / 2,
      H / 2,
    );
    return { commitCount: 0 };
  }

  // Detect new commits and edges for animation.
  const now = performance.now();
  for (const c of S.commits) {
    if (!knownCommits.has(c.id)) {
      knownCommits.add(c.id);
      const isMerge = c.parents.length > 1;
      startAnim("commit", c.id, now);
      for (const pid of c.parents) {
        if (!pid) continue;
        const ek = edgeKey(pid, c.id);
        if (!knownEdges.has(ek)) {
          knownEdges.add(ek);
          startAnim(isMerge ? "merge-edge" : "edge", ek, now);
        }
      }
    }
  }

  const rowOf: Record<string, number> = {};
  S.commits.forEach((c, i) => (rowOf[c.id] = i));
  // Center the column range horizontally in the canvas.
  const graphMidCol = (maxCol + minCol) / 2;
  const centerX = W / 2 - graphMidCol * COL;
  const cxOf = (id: string) => centerX + (colOf[id] ?? 0) * COL;
  const cyOf = (id: string) => PT + rowOf[id] * ROW;

  function renderFrame() {
    const frameNow = performance.now();
    const animating = tickAnimations(frameNow);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // ── EDGES ────────────────────────────────────────────
    S.commits.forEach((c) => {
      c.parents.filter(Boolean).forEach((pid) => {
        const parentId = pid as string;
        if (rowOf[parentId] === undefined) return;
        const x1 = cxOf(parentId),
          y1 = cyOf(parentId),
          x2 = cxOf(c.id),
          y2 = cyOf(c.id);
        const col = branchColor(c.branch || "main");
        const ek = edgeKey(parentId, c.id);
        const progress = getAnimProgress(ek);

        ctx.save();
        ctx.globalAlpha = 0.4 * progress;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";

        if (x1 === x2) {
          const startY = y1 + CR;
          const endY = y2 - CR;
          const currentEndY = startY + (endY - startY) * progress;
          ctx.beginPath();
          ctx.moveTo(x1, startY);
          ctx.lineTo(x2, currentEndY);
        } else {
          const startY = y1 + CR;
          const endY = y2 - CR;
          const my = (startY + endY) / 2;
          if (progress >= 1) {
            ctx.beginPath();
            ctx.moveTo(x1, startY);
            ctx.bezierCurveTo(x1, my, x2, my, x2, endY);
          } else {
            drawPartialBezier(
              ctx,
              x1,
              startY,
              x1,
              my,
              x2,
              my,
              x2,
              endY,
              progress,
            );
          }
        }
        ctx.stroke();
        ctx.restore();
      });
    });

    // ── COMMITS ──────────────────────────────────────────
    S.commits.forEach((c) => {
      const x = cxOf(c.id),
        y = cyOf(c.id);
      const isMerge = c.parents.length > 1;
      const col = branchColor(c.branch || "main");
      const isHead = S.detached
        ? S.HEAD === c.id
        : S.HEAD
          ? S.branches[S.HEAD] === c.id
          : false;
      const commitProgress = getAnimProgress(c.id);

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
        ...ptTags.map((t) => ({
          text: "tag:" + t,
          color: "#8b5cf6",
          isHead: false,
        })),
      ];

      ctx.save();
      ctx.globalAlpha = commitProgress;

      // Scale-in animation.
      if (commitProgress < 1) {
        const scale = 0.3 + 0.7 * commitProgress;
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.translate(-x, -y);
      }

      // ── LABELS ───────────────────────────────────────
      const LH = 22,
        LG = 4;
      const totalLH = labels.length * (LH + LG);
      ctx.font = "600 9.5px Geist Mono,monospace";

      labels.forEach((lbl, li) => {
        const lx = x;
        const ly = y - CR - 14 - totalLH + li * (LH + LG);
        const text = (lbl.isHead ? "\u25B6 " : "") + lbl.text;
        const tw = ctx.measureText(text).width;
        const pw = tw + 18,
          ph = LH;
        const px = lx - pw / 2,
          py = ly;

        ctx.shadowColor = "rgba(0,0,0,0.06)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
        rrect(ctx, px, py, pw, ph, 6);
        ctx.fillStyle = lbl.isHead ? lbl.color : "#ffffff";
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = lbl.isHead ? lbl.color : lbl.color + "40";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = lbl.isHead ? "#ffffff" : lbl.color;
        ctx.textAlign = "center";
        ctx.fillText(text, lx, py + 14.5);

        if (li === labels.length - 1) {
          ctx.beginPath();
          ctx.strokeStyle = lbl.color + "30";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.moveTo(lx, py + ph);
          ctx.lineTo(lx, y - CR - 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Detached HEAD annotation.
      if (S.detached && isHead) {
        const dy = y - CR - (totalLH || 0) - 30;
        ctx.font = "600 9px Geist,sans-serif";
        ctx.fillStyle = "#71717a";
        ctx.textAlign = "center";
        ctx.fillText("HEAD (detached)", x, dy);
      }

      // ── HEAD GLOW ──────────────────────────────────
      if (isHead) {
        const [r, g, b] = hexToRgb(col);
        ctx.shadowColor = `rgba(${r},${g},${b},0.2)`;
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 0;
        ctx.beginPath();
        ctx.arc(x, y, CR + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.15)`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      // ── COMMIT CIRCLE ──────────────────────────────
      ctx.shadowColor = "rgba(0,0,0,0.10)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.arc(x, y, CR, 0, Math.PI * 2);

      if (isHead) {
        const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, CR);
        const [r, g, b] = hexToRgb(col);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
        grad.addColorStop(1, col);
        ctx.fillStyle = grad;
      } else if (isMerge) {
        const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, CR);
        const [r, g, b] = hexToRgb(col);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.7)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0.9)`);
        ctx.fillStyle = grad;
      } else {
        const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, CR);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(1, "#f8f8fa");
        ctx.fillStyle = grad;
      }
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      if (isHead) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = col + "90";
        ctx.lineWidth = 2;
      }
      ctx.stroke();

      // Inner highlight (gloss).
      ctx.beginPath();
      ctx.arc(x, y - 2, CR - 5, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Merge icon overlay.
      if (isMerge) {
        ctx.save();
        ctx.strokeStyle = isHead
          ? "rgba(255,255,255,0.8)"
          : "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 4);
        ctx.lineTo(x, y + 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 5, y - 4);
        ctx.lineTo(x, y + 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + 1);
        ctx.lineTo(x, y + 5);
        ctx.stroke();
        ctx.restore();
      }

      // Short hash (only for non-merge commits).
      if (!isMerge) {
        ctx.font = "600 8.5px Geist Mono,monospace";
        ctx.fillStyle = isHead ? "rgba(255,255,255,0.95)" : col;
        ctx.textAlign = "center";
        ctx.fillText(c.id.slice(0, 5), x, y + 3.5);
      }

      // Commit message.
      ctx.font = "500 12.5px Geist,sans-serif";
      ctx.fillStyle = isHead ? "#18181b" : "#52525b";
      ctx.textAlign = "left";
      const msg = c.msg.length > 28 ? c.msg.slice(0, 28) + "\u2026" : c.msg;
      ctx.fillText(msg, x + CR + 14, y + 1);

      // Commit hash subtitle.
      ctx.font = "400 10px Geist Mono,monospace";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText(c.id.slice(0, 7), x + CR + 14, y + 16);

      ctx.restore();
    });

    if (animating) {
      rafHandle = requestAnimationFrame(renderFrame);
    }
  }

  renderFrame();
  return { commitCount: rows };
}
