import { type RepoState, type Commit, fresh } from "./gitState";

// ─── Shared types ──────────────────────────────────────────
export type ImportedCommit = {
  // Full or short SHA — whatever the source provides. We normalise to a stable
  // 7-char id at the end so the renderer + hit-test stay consistent.
  sha: string;
  msg: string;
  parents: string[];
  branch: string | null;
  author: string;
  ts: string;
};

export type ImportedRepo = {
  commits: ImportedCommit[];
  // Maps branch name → tip SHA (full or short, must match a commit.sha above).
  branches: Record<string, string>;
  // Branch name to mark as HEAD. Defaults to first branch if not provided.
  defaultBranch?: string;
  remoteUrl?: string;
};

// ─── GitHub API ────────────────────────────────────────────
// Parses things like:
//   https://github.com/owner/repo
//   https://github.com/owner/repo.git
//   git@github.com:owner/repo.git
//   github.com/owner/repo/tree/branch
//   owner/repo
export function parseGitHubUrl(
  raw: string,
): { owner: string; repo: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // ssh form
  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  // http(s) or bare github.com path
  const m = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/?#]+)/i,
  );
  if (m) {
    const repo = m[2].replace(/\.git$/i, "");
    return { owner: m[1], repo };
  }
  // shorthand "owner/repo"
  const short = trimmed.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (short) return { owner: short[1], repo: short[2] };
  return null;
}

type GHBranch = { name: string; commit: { sha: string } };
type GHCommit = {
  sha: string;
  commit: {
    message: string;
    author?: { name?: string; date?: string } | null;
  };
  parents: { sha: string }[];
};

async function ghFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    let msg = `GitHub API ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) msg += `: ${body.message}`;
    } catch {
      /* ignore non-JSON body */
    }
    if (res.status === 403)
      msg +=
        " (rate-limited — GitHub allows 60 unauthenticated requests/hour per IP)";
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function fetchGitHubRepo(
  owner: string,
  repo: string,
  commitsPerBranch = 50,
): Promise<ImportedRepo> {
  // First, the repo metadata to learn the default branch.
  const meta = await ghFetch<{ default_branch: string }>(
    `https://api.github.com/repos/${owner}/${repo}`,
  );
  const defaultBranch = meta.default_branch;

  // Branches list (up to 100 — sufficient for nearly every repo).
  const branches = await ghFetch<GHBranch[]>(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
  );

  // Fetch commits per branch in parallel. Each request returns most-recent
  // first; we'll reverse at the end so the canvas renders oldest → newest.
  const seen = new Map<string, ImportedCommit>();
  const branchTipMap: Record<string, string> = {};

  await Promise.all(
    branches.map(async (b) => {
      branchTipMap[b.name] = b.commit.sha;
      try {
        const commits = await ghFetch<GHCommit[]>(
          `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(
            b.name,
          )}&per_page=${commitsPerBranch}`,
        );
        for (const c of commits) {
          if (seen.has(c.sha)) {
            // First branch to claim a commit wins; later branches don't
            // overwrite the lane assignment. This keeps the layout stable.
            continue;
          }
          seen.set(c.sha, {
            sha: c.sha,
            msg: (c.commit.message || "").split("\n")[0],
            parents: c.parents.map((p) => p.sha),
            branch: b.name,
            author: c.commit.author?.name || "unknown",
            ts: c.commit.author?.date || "",
          });
        }
      } catch (err) {
        // A single branch failing (e.g. weird ref) shouldn't sink the whole
        // import. Log and move on.
        console.warn(`Failed to fetch commits for branch ${b.name}:`, err);
      }
    }),
  );

  // Sort oldest → newest by author date so commits appear in chronological
  // order in the renderer. Commits with no date sink to the bottom.
  const ordered = Array.from(seen.values()).sort((a, b) => {
    const ta = a.ts ? Date.parse(a.ts) : 0;
    const tb = b.ts ? Date.parse(b.ts) : 0;
    return ta - tb;
  });

  return {
    commits: ordered,
    branches: branchTipMap,
    defaultBranch,
    remoteUrl: `https://github.com/${owner}/${repo}.git`,
  };
}

// ─── git log parser ────────────────────────────────────────
// Accepts output of:
//   git log --all --pretty=format:"%H|%P|%an|%ai|%s" --date-order
// OR the more common interactive form:
//   git log --all --graph --oneline --decorate
// We do best-effort parsing — graph ASCII gets stripped, decorations parsed.
export function parseGitLog(raw: string): ImportedRepo | { error: string } {
  const text = raw.trim();
  if (!text) return { error: "Paste some git log output to import." };

  // Detect format: pipe-delimited custom format vs. --oneline --decorate.
  const lines = text.split(/\r?\n/);

  // Try pipe format first — most reliable.
  const pipeRows = lines
    .map((l) => l.replace(/^[\s*|\\/_+\-.]+/, ""))
    .filter((l) => /^[a-f0-9]{4,40}\|/.test(l));
  if (pipeRows.length >= 1) {
    return parsePipeFormat(pipeRows);
  }

  // Fallback: --oneline --decorate output.
  return parseOnelineFormat(lines);
}

function parsePipeFormat(rows: string[]): ImportedRepo {
  const commits: ImportedCommit[] = [];
  const branchTips: Record<string, string> = {};
  // Heuristic for branch assignment: most-recent commit per branch label.
  for (const row of rows) {
    const parts = row.split("|");
    if (parts.length < 5) continue;
    const [sha, parentsRaw, author, ts, ...msgParts] = parts;
    const msg = msgParts.join("|");
    const parents = parentsRaw.trim().split(/\s+/).filter(Boolean);
    commits.push({
      sha: sha.trim(),
      msg: msg.trim(),
      parents,
      branch: null, // filled in below
      author: author.trim(),
      ts: ts.trim(),
    });
  }
  // git log returns newest first; we need oldest first for layout.
  commits.reverse();
  // Without --decorate we can't know which branches exist. Synthesise one
  // pseudo-branch "main" pointing at the youngest commit so the canvas
  // renders something coherent.
  if (commits.length) {
    branchTips["main"] = commits[commits.length - 1].sha;
    commits.forEach((c) => (c.branch = "main"));
  }
  return { commits, branches: branchTips, defaultBranch: "main" };
}

function parseOnelineFormat(lines: string[]): ImportedRepo | { error: string } {
  // Expected per-line form (loose):
  //   * abc1234 (HEAD -> main, origin/main) commit message
  //   |\
  //   | * def5678 (feature) another commit
  const commits: ImportedCommit[] = [];
  const branchTips: Record<string, string> = {};
  let defaultBranch: string | undefined;

  for (const raw of lines) {
    // Strip leading ASCII graph chars.
    const line = raw.replace(/^[\s*|\\/_+\-.]+/, "");
    const m = line.match(/^([a-f0-9]{4,40})\b(.*)$/i);
    if (!m) continue;
    const sha = m[1];
    let rest = m[2].trim();

    // Pull decorations: (HEAD -> main, origin/main, tag: v1)
    const decoMatch = rest.match(/^\(([^)]+)\)\s*/);
    const branchesHere: string[] = [];
    if (decoMatch) {
      const decos = decoMatch[1].split(",").map((d) => d.trim());
      for (const d of decos) {
        // "HEAD -> main" → main is HEAD's branch
        const headArrow = d.match(/^HEAD\s*->\s*(.+)$/);
        if (headArrow) {
          branchesHere.push(headArrow[1]);
          if (!defaultBranch) defaultBranch = headArrow[1];
          continue;
        }
        if (d === "HEAD") continue;
        if (/^tag:/i.test(d)) continue;
        if (/^origin\//i.test(d)) continue;
        branchesHere.push(d);
      }
      rest = rest.slice(decoMatch[0].length);
    }

    commits.push({
      sha,
      msg: rest || "(no message)",
      // --oneline doesn't give parents — we infer below from row order +
      // graph indentation. Best-effort linear chain for now.
      parents: [],
      branch: branchesHere[0] ?? null,
      author: "imported",
      ts: "",
    });

    for (const b of branchesHere) {
      if (!(b in branchTips)) branchTips[b] = sha;
    }
  }

  if (!commits.length) {
    return {
      error:
        "Couldn't parse any commits. Try the pipe format:\n  git log --all --pretty=format:\"%H|%P|%an|%ai|%s\"",
    };
  }

  // Reverse so oldest first.
  commits.reverse();
  // Infer linear parents (each commit's parent = previous in list).
  for (let i = 1; i < commits.length; i++) {
    commits[i].parents = [commits[i - 1].sha];
  }
  // Fill in branch on commits that didn't carry decoration — they inherit
  // from the next commit ahead that does have one.
  let carry: string | null = defaultBranch ?? null;
  for (let i = commits.length - 1; i >= 0; i--) {
    if (commits[i].branch) carry = commits[i].branch;
    else commits[i].branch = carry;
  }
  if (!defaultBranch && Object.keys(branchTips).length) {
    defaultBranch = Object.keys(branchTips)[0];
  }
  if (!defaultBranch) {
    defaultBranch = "main";
    branchTips["main"] = commits[commits.length - 1].sha;
    commits.forEach((c) => (c.branch ??= "main"));
  }

  return { commits, branches: branchTips, defaultBranch };
}

// ─── Apply ImportedRepo onto RepoState ─────────────────────
// Wipes existing state and rebuilds it from the import. SHAs are normalised
// to 7-char ids so they line up with the engine's own makeId() output.
export function applyImport(into: RepoState, imp: ImportedRepo): void {
  const blank = fresh();
  Object.assign(into, blank);
  into.inited = true;

  const shaToId = new Map<string, string>();
  const norm = (sha: string) => {
    const trimmed = sha.trim();
    if (!trimmed) return null;
    let id = shaToId.get(trimmed);
    if (id) return id;
    // Match by prefix — git lets you reference any unique prefix.
    for (const [existing, existingId] of shaToId) {
      if (existing.startsWith(trimmed) || trimmed.startsWith(existing)) {
        shaToId.set(trimmed, existingId);
        return existingId;
      }
    }
    id = trimmed.slice(0, 7).padStart(7, "0");
    shaToId.set(trimmed, id);
    return id;
  };

  // First pass: register every commit's id.
  for (const c of imp.commits) norm(c.sha);

  // Second pass: build Commit objects with normalised parent ids.
  const commits: Commit[] = imp.commits.map((c) => ({
    id: norm(c.sha)!,
    msg: c.msg || "(no message)",
    parents: c.parents.map((p) => norm(p)).filter(Boolean) as string[],
    branch: c.branch,
    author: c.author,
    ts: c.ts,
  }));
  into.commits = commits;

  // Branches.
  for (const [name, tipSha] of Object.entries(imp.branches)) {
    into.branches[name] = norm(tipSha);
  }

  // HEAD.
  if (imp.defaultBranch && imp.defaultBranch in into.branches) {
    into.HEAD = imp.defaultBranch;
  } else {
    const first = Object.keys(into.branches)[0];
    into.HEAD = first ?? null;
  }
  into.detached = false;

  // Remote — register origin if a URL came along.
  if (imp.remoteUrl) {
    into.remotes["origin"] = imp.remoteUrl;
    // Mirror local branches as origin/<branch> so the canvas shows tracking refs.
    for (const [name, tip] of Object.entries(into.branches)) {
      if (tip) into.remoteBranches[`origin/${name}`] = tip;
    }
  }

  // Pre-seed counter past any numeric ids we accidentally collide with.
  into.counter = commits.length + 1;
}
