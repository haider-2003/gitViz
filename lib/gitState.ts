export type Commit = {
  id: string;
  msg: string;
  parents: (string | null)[];
  branch: string | null;
  author: string;
  ts: string;
};

export type Stash = { msg: string; branch: string; commitId: string | null };
export type ReflogEntry = {
  action: string;
  desc: string;
  branch: string | null;
  to: string;
};
export type Tag = { commitId: string; annotated: boolean; msg: string };

export type RepoState = {
  inited: boolean;
  commits: Commit[];
  branches: Record<string, string | null>;
  HEAD: string | null;
  detached: boolean;
  tags: Record<string, Tag>;
  stashes: Stash[];
  staged: string[];
  working: string[];
  remotes: Record<string, string>;
  config: Record<string, string>;
  reflog: ReflogEntry[];
  counter: number;
  prevBranch: string | null;
  onelineMode: boolean;
};

export function fresh(): RepoState {
  return {
    inited: false,
    commits: [],
    branches: {},
    HEAD: null,
    detached: false,
    tags: {},
    stashes: [],
    staged: [],
    working: [],
    remotes: {},
    config: { "user.name": "You", "user.email": "you@example.com" },
    reflog: [],
    counter: 0,
    prevBranch: null,
    onelineMode: false,
  };
}

export function makeId(S: RepoState): string {
  S.counter++;
  return ((S.counter * 0x9e3779b9) >>> 0)
    .toString(16)
    .padStart(7, "0")
    .slice(0, 7);
}

export function headCommit(S: RepoState): Commit | null {
  if (!S.HEAD) return null;
  if (S.detached) return S.commits.find((c) => c.id === S.HEAD) ?? null;
  return S.commits.find((c) => c.id === S.branches[S.HEAD!]) ?? null;
}

export function ancestors(
  S: RepoState,
  cid: string | null,
  seen: Set<string> = new Set(),
): Set<string> {
  if (!cid || seen.has(cid)) return seen;
  seen.add(cid);
  const c = S.commits.find((x) => x.id === cid);
  if (c) c.parents.filter(Boolean).forEach((p) => ancestors(S, p as string, seen));
  return seen;
}

export function isAncestor(S: RepoState, anc: string, ofId: string): boolean {
  return ancestors(S, ofId).has(anc);
}

export function now(): string {
  return new Date().toLocaleString();
}

export function pushRL(S: RepoState, action: string, desc: string) {
  S.reflog.unshift({
    action,
    desc,
    branch: S.HEAD,
    to: (S.detached ? S.HEAD : S.HEAD ? S.branches[S.HEAD] : null) || "null",
  });
  if (S.reflog.length > 60) S.reflog.pop();
}
