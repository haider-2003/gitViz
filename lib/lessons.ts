import {
  type RepoState,
  fresh,
  makeId,
  now,
  type Commit,
} from "./gitState";

// ─── Types ─────────────────────────────────────────────────
export type LessonDifficulty = "beginner" | "intermediate" | "advanced";

// Stages form a roadmap. Each stage gates the next: you must complete at
// least ~60% of a stage before the next stage unlocks. This drives
// progression without being so strict that advanced users get stuck.
export type StageId =
  | "foundations"
  | "branching"
  | "history"
  | "collaboration"
  | "recovery"
  | "advanced";

export type Stage = {
  id: StageId;
  title: string;
  description: string;
  // Order matters — earlier stages render first and gate later ones.
  order: number;
};

export const STAGES: Stage[] = [
  {
    id: "foundations",
    title: "Foundations",
    description:
      "The repository, staging area, and commit. Everything else is built on these three concepts.",
    order: 1,
  },
  {
    id: "branching",
    title: "Branching & Merging",
    description:
      "Branches are movable labels. Merging combines work. Learn fast-forward, merge commits, and when to use each.",
    order: 2,
  },
  {
    id: "history",
    title: "Rewriting History",
    description:
      "Amend, reset, rebase, cherry-pick, revert. The tools that let you reshape what already happened — and the danger of doing it on shared branches.",
    order: 3,
  },
  {
    id: "collaboration",
    title: "Collaboration",
    description:
      "Remotes, clone, fetch, pull, push, tracking branches. How git becomes a team tool.",
    order: 4,
  },
  {
    id: "recovery",
    title: "Recovery & Debugging",
    description:
      "The reflog, lost commits, aborting half-done operations, and bisecting bugs. The 'oh no' kit.",
    order: 5,
  },
  {
    id: "advanced",
    title: "Advanced Workflows",
    description:
      "Stash, tags, detached HEAD, submodules, worktrees, hooks. The corners professionals know.",
    order: 6,
  },
];

// Fraction of a stage that must be complete to unlock the next stage.
// 0.6 means 6/10 lessons. Adjust if it feels too strict in practice.
const UNLOCK_THRESHOLD = 0.6;

export type Lesson = {
  id: string;
  stage: StageId;
  title: string;
  difficulty: LessonDifficulty;
  // One-line summary shown in the list.
  blurb: string;
  // 2-4 sentence conceptual explainer shown above the goal. Reads like a
  // mini-textbook chapter — the "why does this command exist" framing.
  concept: string;
  // The concrete task the learner must accomplish.
  goal: string;
  // Progressive hints — revealed one at a time when the learner asks.
  hints: string[];
  // Builds the starting RepoState. Must produce commits in chronological
  // (oldest-first) order — see comments on builder helpers below.
  setup: () => RepoState;
  // Returns true once the learner has reached the goal.
  isComplete: (state: RepoState) => boolean;
  // Shown when the lesson is completed. Reinforce why this matters.
  successNote?: string;
};

export type QuizOption = {
  label: string;
  correct: boolean;
  explanation: string;
};

export type Quiz = {
  id: string;
  stage: StageId;
  topic: string;
  difficulty: LessonDifficulty;
  scenario: string;
  setup?: () => RepoState;
  question: string;
  options: QuizOption[];
};

// ─── Builders ──────────────────────────────────────────────
// CRITICAL: The renderer's buildLayout assigns each commit's row from its
// index in S.commits. For the canvas to look right, commits MUST be pushed
// in chronological order (oldest first). When two branches have commits
// happening "at the same time", interleave them by the order they actually
// occurred — never bulk-push all of one branch then all of another.
//
// The high-level helpers below handle this automatically. Stick to them.

function emptyInited(): RepoState {
  const s = fresh();
  s.inited = true;
  s.branches["main"] = null;
  s.HEAD = "main";
  return s;
}

// Pushes a single commit onto the named branch and advances the branch tip.
// `parentIds` defaults to [current tip of branch] for convenience.
function pushCommit(
  s: RepoState,
  msg: string,
  branch: string,
  parents?: string[],
): Commit {
  const id = makeId(s);
  const tip = s.branches[branch];
  const finalParents =
    parents !== undefined ? parents : tip ? [tip] : [];
  const c: Commit = {
    id,
    msg,
    parents: finalParents,
    branch,
    author: "you",
    ts: now(),
  };
  s.commits.push(c);
  s.branches[branch] = id;
  return c;
}

// Pushes a sequence of commits onto a branch in order.
function pushSequence(
  s: RepoState,
  branch: string,
  msgs: string[],
): string[] {
  return msgs.map((m) => pushCommit(s, m, branch).id);
}

// Forks `newBranch` off `fromBranch` at the named branch's current tip.
// HEAD is unchanged — call `checkout` if you want to move onto the new
// branch. The new branch has no commits of its own yet.
function fork(s: RepoState, newBranch: string, fromBranch: string) {
  s.branches[newBranch] = s.branches[fromBranch] ?? null;
}

// Moves HEAD to a branch.
function checkout(s: RepoState, branch: string) {
  s.HEAD = branch;
  s.detached = false;
}

// ─── Goal-predicate helpers ────────────────────────────────
function hasBranch(s: RepoState, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(s.branches, name);
}

function isMergeCommit(c: Commit): boolean {
  return c.parents.length > 1;
}

function headIsAt(s: RepoState, branch: string): boolean {
  return !s.detached && s.HEAD === branch;
}

function tipMsgIncludes(s: RepoState, branch: string, needle: string): boolean {
  const tip = s.branches[branch];
  if (!tip) return false;
  const c = s.commits.find((x) => x.id === tip);
  return !!c && c.msg.toLowerCase().includes(needle.toLowerCase());
}

function commitCountOnBranch(s: RepoState, branch: string): number {
  // Count commits reachable from branch tip via first-parent.
  const tip = s.branches[branch];
  if (!tip) return 0;
  let n = 0;
  let cursor: string | null = tip;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    n++;
    const c = s.commits.find((x) => x.id === cursor);
    cursor = c?.parents[0] ?? null;
  }
  return n;
}

function isFastForwardOf(s: RepoState, branch: string, of: string): boolean {
  // True if `branch` tip == `of` tip OR `of` tip is reachable from `branch`
  // tip via first-parent (i.e. branch fast-forwarded past `of`).
  const branchTip = s.branches[branch];
  const ofTip = s.branches[of];
  if (!branchTip || !ofTip) return false;
  let cursor: string | null = branchTip;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    if (cursor === ofTip) return true;
    const c = s.commits.find((x) => x.id === cursor);
    cursor = c?.parents[0] ?? null;
  }
  return false;
}

// ─── LESSONS ───────────────────────────────────────────────
// Ordered by stage, then by intra-stage difficulty progression.

export const LESSONS: Lesson[] = [
  // ═══════════════════════════════════════════════════════
  // STAGE 1 — FOUNDATIONS (5 lessons)
  // ═══════════════════════════════════════════════════════

  {
    id: "f1-init",
    stage: "foundations",
    title: "Initialise a repository",
    difficulty: "beginner",
    blurb: "Every git project starts with `git init`.",
    concept:
      "A git repository is just a folder with a hidden `.git/` directory inside. That hidden folder stores every snapshot you've ever committed, every branch label, and every configuration. `git init` creates it. Without it, git commands have nothing to operate on.",
    goal: "Initialise the repository.",
    hints: [
      "Type: git init",
      "After running it, the canvas placeholder will change from 'run git init' to an empty repo ready for commits.",
    ],
    setup: () => fresh(),
    isComplete: (s) => s.inited,
    successNote:
      "You now have a repository with a default branch called `main` and no commits. Branches in git always need to point at a commit, so `main` is currently a placeholder waiting for its first commit.",
  },

  {
    id: "f2-first-commit",
    stage: "foundations",
    title: "Your first commit",
    difficulty: "beginner",
    blurb: "Stage some changes, then snapshot them with a commit.",
    concept:
      "Git tracks your work in three areas: the **working directory** (files you're editing), the **staging area** (changes you've marked for the next commit), and the **commit history** (snapshots). You use `git add` to move changes from working → staging, and `git commit` to turn the staging area into a new snapshot.",
    goal:
      "Stage something with `git add .`, then create a commit with any message.",
    hints: [
      "Stage everything: git add .",
      'Commit with a message: git commit -m "first commit"',
      "Watch the canvas — a circle appears for each commit, with the branch label pinned to it.",
    ],
    setup: () => {
      const s = emptyInited();
      s.working = ["README.md"];
      return s;
    },
    isComplete: (s) => s.commits.length >= 1 && s.staged.length === 0,
    successNote:
      "Each commit is a complete snapshot, not a diff. Git stores them efficiently (deduping content) but conceptually you can travel to any commit and see exactly what existed at that moment.",
  },

  {
    id: "f3-status",
    stage: "foundations",
    title: "Check the status",
    difficulty: "beginner",
    blurb: "`git status` tells you where you are and what's changed.",
    concept:
      "`git status` is the most-run command in git. It tells you which branch you're on, whether HEAD is detached, what's staged, what's modified but not staged, and what files git isn't tracking. Run it constantly — it answers 'what's going on right now?'",
    goal:
      "Run `git status`. The terminal will print the current state and a pulse will flash on HEAD.",
    hints: [
      "Just type: git status",
      "Notice the HEAD commit gets a brief ring on the canvas confirming the command registered.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial commit"]);
      s.working = ["src/index.ts"];
      return s;
    },
    isComplete: (s) =>
      s.lastAction?.kind === "inspect" && s.commits.length >= 1,
    successNote:
      "Get in the habit of running `git status` before and after every operation. It's free and it catches mistakes early.",
  },

  {
    id: "f4-log",
    stage: "foundations",
    title: "Read the history with `git log`",
    difficulty: "beginner",
    blurb:
      "`git log` walks the commit history. `--oneline` makes it compact.",
    concept:
      "Git history is a directed graph of commits, each pointing at its parent(s). `git log` walks from HEAD backward through that graph. By default it shows full commit details; `--oneline` collapses each commit to one line, which is usually what you want for a quick read.",
    goal: "Run `git log --oneline` to see the compact history.",
    hints: [
      "Try: git log --oneline",
      "Toggle the --oneline button in the header for a persistent compact view.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", [
        "initial commit",
        "add login page",
        "fix typo in README",
        "implement signup",
      ]);
      return s;
    },
    isComplete: (s) => s.lastAction?.kind === "inspect" && s.commits.length >= 4,
    successNote:
      "Real-world: `git log --oneline --graph --all` is the power-user version. It shows every branch's commits as an ASCII graph. The canvas you've been looking at is the visual equivalent.",
  },

  {
    id: "f5-second-commit",
    stage: "foundations",
    title: "Iterate: add, commit, repeat",
    difficulty: "beginner",
    blurb: "The basic loop: change → stage → commit.",
    concept:
      "Most of git is just this loop. You edit files. You stage what you want included with `git add`. You snapshot with `git commit`. Then you do it again. Small commits with clear messages are the unit of professional git use — easier to review, easier to revert, easier to understand a year later.",
    goal:
      "Make a second commit so the canvas shows at least two commits on `main`.",
    hints: [
      "Stage: git add .",
      'Commit: git commit -m "your message"',
      "The canvas should now show two circles connected by an edge.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial commit"]);
      s.working = ["src/feature.ts"];
      return s;
    },
    isComplete: (s) => commitCountOnBranch(s, "main") >= 2,
    successNote:
      "Notice how the canvas drew an edge between the two commits — that edge represents the parent pointer. The second commit's `parents` array contains the first commit's ID.",
  },

  // ═══════════════════════════════════════════════════════
  // STAGE 2 — BRANCHING & MERGING (8 lessons)
  // ═══════════════════════════════════════════════════════

  {
    id: "b1-create-branch",
    stage: "branching",
    title: "Create a branch",
    difficulty: "beginner",
    blurb: "Branches are just movable labels pointing at a commit.",
    concept:
      "A branch in git is one of the simplest data structures imaginable: a file containing the SHA of a commit. `git branch <name>` creates a new label pointing at the current commit. It does NOT switch you onto it — HEAD doesn't move.",
    goal:
      "Create a branch called `feature`. HEAD should stay on main.",
    hints: [
      "Type: git branch feature",
      "Check the canvas — both `main` and `feature` labels are now pinned to the same commit, but HEAD (the ▶ marker) is still on `main`.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "add base files"]);
      return s;
    },
    isComplete: (s) => hasBranch(s, "feature") && headIsAt(s, "main"),
    successNote:
      "Two labels can point at the same commit. That's all branching is: another label. Cheap, fast, ubiquitous — which is why git encourages branching for everything.",
  },

  {
    id: "b2-checkout-branch",
    stage: "branching",
    title: "Switch to a branch",
    difficulty: "beginner",
    blurb: "`git checkout` (or modern `git switch`) moves HEAD.",
    concept:
      "HEAD is git's bookmark — 'where am I right now?' Switching branches moves HEAD to point at a different branch label. The working directory updates to match. Modern git prefers `git switch` over `git checkout` for branch switching, since `checkout` is overloaded with file operations too.",
    goal: "Switch HEAD to the existing `feature` branch.",
    hints: [
      "Modern: git switch feature",
      "Classic: git checkout feature",
      "The ▶ marker on the canvas will move to the feature label.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "add base files"]);
      fork(s, "feature", "main");
      return s;
    },
    isComplete: (s) => headIsAt(s, "feature"),
    successNote:
      "Switching is instant because no files actually move — git just rewrites them based on the target commit's snapshot. (In this simulator, file content isn't modeled, but the concept holds.)",
  },

  {
    id: "b3-checkout-b",
    stage: "branching",
    title: "Create and switch in one step",
    difficulty: "beginner",
    blurb: "`git switch -c <name>` is create + switch combined.",
    concept:
      "Creating a branch and switching to it is so common that git has a shortcut for it. `git switch -c new-branch` (or the older `git checkout -b new-branch`) creates the branch AND moves HEAD onto it in one command. Use this 95% of the time.",
    goal:
      "In one command, create a branch called `experiment` and switch onto it.",
    hints: [
      "Modern: git switch -c experiment",
      "Classic: git checkout -b experiment",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "stable point"]);
      return s;
    },
    isComplete: (s) => hasBranch(s, "experiment") && headIsAt(s, "experiment"),
    successNote:
      "Branching is so cheap in git that the community convention is 'one branch per task'. Even for a 5-minute fix.",
  },

  {
    id: "b4-commit-on-branch",
    stage: "branching",
    title: "Commit on a feature branch",
    difficulty: "beginner",
    blurb: "Commits made while HEAD is on a branch move that branch forward.",
    concept:
      "When you commit, the current branch label moves to point at the new commit. HEAD follows along. Other branches stay where they are — which is how branches diverge in the first place.",
    goal:
      "You're on `feature`. Make one commit. `feature` should move forward; `main` should stay put.",
    hints: [
      'git add . then git commit -m "..."',
      "After committing, the feature label moves to the new commit while main stays where it was.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "setup"]);
      fork(s, "feature", "main");
      checkout(s, "feature");
      s.working = ["src/feature.ts"];
      return s;
    },
    isComplete: (s) => {
      const featTip = s.branches["feature"];
      const mainTip = s.branches["main"];
      return !!featTip && !!mainTip && featTip !== mainTip;
    },
    successNote:
      "This is divergence — feature is now ahead of main. The canvas shows the feature branch peeling off into its own lane.",
  },

  {
    id: "b5-fast-forward-merge",
    stage: "branching",
    title: "Fast-forward merge",
    difficulty: "beginner",
    blurb: "When the target branch is strictly behind, merging just moves the label.",
    concept:
      "If main hasn't moved since you branched off, merging your feature back is trivial: git just slides main's label forward to wherever feature is. No merge commit, no conflicts, no history change. This is a 'fast-forward' merge — git's default when it's possible.",
    goal:
      "You're on feature with extra commits. Switch to main and merge feature. It should fast-forward (no merge commit appears).",
    hints: [
      "First: git switch main (or git checkout main)",
      "Then: git merge feature",
      "Watch main's label slide forward to feature's tip — no new commit.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "base"]);
      fork(s, "feature", "main");
      checkout(s, "feature");
      pushSequence(s, "feature", ["add login form", "wire up handler"]);
      return s;
    },
    isComplete: (s) =>
      headIsAt(s, "main") &&
      s.branches["main"] === s.branches["feature"] &&
      !s.commits.some(isMergeCommit),
    successNote:
      "Fast-forward keeps history linear. Many teams prefer this for short-lived branches because it reads cleanly in `git log`.",
  },

  {
    id: "b6-no-ff-merge",
    stage: "branching",
    title: "Force a merge commit",
    difficulty: "intermediate",
    blurb: "`--no-ff` creates a merge commit even when fast-forward is possible.",
    concept:
      "Sometimes you WANT to preserve the fact that work happened on a branch — to make a release commit, or just to keep the topology readable. `git merge --no-ff <branch>` forces git to create a merge commit (with two parents) instead of fast-forwarding.",
    goal:
      "Merge `feature` into main but force a merge commit using `--no-ff`.",
    hints: [
      "Switch to main first.",
      "git merge --no-ff feature",
      "The result: a new commit on main with two parent edges meeting at it.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "setup"]);
      fork(s, "feature", "main");
      checkout(s, "feature");
      pushSequence(s, "feature", ["draft API", "handler"]);
      return s;
    },
    isComplete: (s) => {
      if (!headIsAt(s, "main")) return false;
      const tip = s.branches["main"];
      const c = s.commits.find((x) => x.id === tip);
      return !!c && isMergeCommit(c);
    },
    successNote:
      "GitHub's 'Create a merge commit' option in PRs is the same thing. Many teams use --no-ff to make release branches' history obvious.",
  },

  {
    id: "b7-true-merge-divergent",
    stage: "branching",
    title: "Merge two diverged branches",
    difficulty: "intermediate",
    blurb: "When both branches moved, git creates a merge commit by default.",
    concept:
      "If both branches added commits since they diverged, fast-forward is impossible — there's no straight path forward. Git creates a merge commit whose two parents are the tips of each branch. This is git's default merge behavior when histories have actually diverged.",
    goal: "Merge `feature` into `main`. Both have new commits — a merge commit will be created automatically.",
    hints: [
      "You're already on main. Just: git merge feature",
      "A merge commit with two parents appears at main's tip.",
    ],
    setup: () => {
      // Chronological order matters: main commits 1, then feature commits 1,
      // then main commits 2, then feature commits 2 — so the canvas shows
      // proper divergence.
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "setup"]);
      fork(s, "feature", "main");
      // feature does some work
      checkout(s, "feature");
      pushCommit(s, "feat: add navbar", "feature");
      // main does some work in parallel
      checkout(s, "main");
      pushCommit(s, "fix: typo in docs", "main");
      // feature continues
      checkout(s, "feature");
      pushCommit(s, "feat: add footer", "feature");
      // main does another fix
      checkout(s, "main");
      pushCommit(s, "fix: broken link", "main");
      // Land back on main, ready to merge.
      checkout(s, "main");
      return s;
    },
    isComplete: (s) => {
      if (!headIsAt(s, "main")) return false;
      const tip = s.branches["main"];
      const c = s.commits.find((x) => x.id === tip);
      return !!c && isMergeCommit(c);
    },
    successNote:
      "Real-world merges of long-lived branches almost always look like this. The merge commit is git's record that 'here's where these two histories joined back up.'",
  },

  {
    id: "b8-delete-branch",
    stage: "branching",
    title: "Delete a merged branch",
    difficulty: "beginner",
    blurb: "Once a branch is merged, you usually delete it.",
    concept:
      "Branches are cheap, but stale branches clutter the list. After you merge, delete the branch. `git branch -d <name>` is the safe form — it refuses to delete if the branch has unmerged commits. `git branch -D <name>` (capital D) deletes anyway.",
    goal: "Delete the `feature` branch. It's already merged into main, so the safe `-d` flag will work.",
    hints: [
      "git branch -d feature",
      "(You can't delete the branch you're currently on, so make sure you're on main first.)",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "setup"]);
      fork(s, "feature", "main");
      checkout(s, "feature");
      pushSequence(s, "feature", ["feat work"]);
      // Fast-forward merge into main.
      checkout(s, "main");
      s.branches["main"] = s.branches["feature"]!;
      return s;
    },
    isComplete: (s) => !hasBranch(s, "feature"),
    successNote:
      "Deleting a branch only removes the label, not the commits. Those commits stay reachable via main (or whatever you merged into).",
  },

  // ═══════════════════════════════════════════════════════
  // STAGE 3 — REWRITING HISTORY (8 lessons)
  // ═══════════════════════════════════════════════════════

  {
    id: "h1-amend-message",
    stage: "history",
    title: "Amend the last commit message",
    difficulty: "intermediate",
    blurb: "Made a typo in your last commit message? Amend it.",
    concept:
      "`git commit --amend` rewrites the most recent commit. It can change the message, add forgotten files, or both. Important: it produces a NEW commit (with a new SHA) that replaces the old one. Never amend a commit that's already been pushed and shared.",
    goal:
      'Amend the last commit, changing its message to "fix login redirect bug".',
    hints: [
      'git commit --amend -m "fix login redirect bug"',
      "The canvas will flash an amber dashed ring around the commit to signal it was rewritten.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "WIP fix"]);
      return s;
    },
    isComplete: (s) => tipMsgIncludes(s, "main", "fix login redirect"),
    successNote:
      "Amend is one of git's most-used rewrite tools. Great for fixing 'oops' moments before you push.",
  },

  {
    id: "h2-reset-soft",
    stage: "history",
    title: "Soft reset: undo commit, keep changes staged",
    difficulty: "intermediate",
    blurb: "`reset --soft` moves the branch back but keeps your work staged.",
    concept:
      "Reset moves the branch label backward in history. `--soft` keeps the changes from the undone commits in the staging area — useful when you want to recommit them differently (squash several into one, or split one apart).",
    goal:
      "Undo the last commit with `git reset --soft HEAD~1`. The commit should be gone from the canvas; main moves back one step.",
    hints: [
      "git reset --soft HEAD~1",
      "HEAD~1 means 'the commit one step before HEAD'.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "good commit", "rushed commit"]);
      return s;
    },
    isComplete: (s) =>
      commitCountOnBranch(s, "main") === 2 &&
      tipMsgIncludes(s, "main", "good commit"),
    successNote:
      "Soft reset is non-destructive to your work. The commits 'disappear' from main but their changes live in the staging area for you to recommit.",
  },

  {
    id: "h3-reset-mixed",
    stage: "history",
    title: "Mixed reset: undo commit, unstage changes",
    difficulty: "intermediate",
    blurb: "`reset` (no flag) is mixed — moves branch back, unstages files.",
    concept:
      "Mixed reset (the default) is one step more aggressive than --soft. It moves the branch back AND unstages the changes. Files stay in your working directory, but you'd need to `git add` again to recommit them.",
    goal:
      "Undo the last commit with `git reset HEAD~1` (no flag = mixed). Staging should be empty after.",
    hints: [
      "git reset HEAD~1",
      "Notice the staging badge disappears — your changes are now only in the working directory.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "good commit"]);
      // Pretend the last commit had staged changes still.
      pushCommit(s, "another commit", "main");
      s.staged = ["modified-file.ts"];
      return s;
    },
    isComplete: (s) =>
      commitCountOnBranch(s, "main") === 2 && s.staged.length === 0,
    successNote:
      "Mixed reset is the default for a reason — it's a safe 'undo this commit, let me try again' button.",
  },

  {
    id: "h4-reset-hard",
    stage: "history",
    title: "Hard reset: destroy everything",
    difficulty: "advanced",
    blurb: "`reset --hard` is the nuclear option. Use with extreme care.",
    concept:
      "`--hard` moves the branch back AND throws away the changes from those commits entirely — staging area cleared, working directory rewritten. The commits aren't *truly* gone (the reflog can rescue them for ~90 days), but for all practical purposes, the work is wiped.",
    goal:
      "The last two commits are bad. Run `git reset --hard HEAD~2` to discard them completely.",
    hints: [
      "git reset --hard HEAD~2",
      "HEAD~2 means 'two commits before HEAD'.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", [
        "initial",
        "stable",
        "broken commit",
        "more broken",
      ]);
      return s;
    },
    isComplete: (s) =>
      commitCountOnBranch(s, "main") === 2 &&
      tipMsgIncludes(s, "main", "stable"),
    successNote:
      "Rule of thumb: never use --hard on a branch you've pushed and shared with others. You'll force everyone else to deal with rewritten history.",
  },

  {
    id: "h5-rebase-basic",
    stage: "history",
    title: "Rebase: replay your commits onto a new base",
    difficulty: "intermediate",
    blurb: "Rebase rewrites your branch to sit on top of another branch's tip.",
    concept:
      "Rebase finds the commits unique to your branch, then replays them one by one on top of a different starting point. The result is a linear history with no merge commits. The replayed commits get NEW SHAs because their parents changed — this is history rewriting.",
    goal:
      "You're on `feature` and main has moved ahead. Rebase feature onto main so feature's commits sit on top of main's tip.",
    hints: [
      "git rebase main (while on feature)",
      "The edges redraw: feature's commits now branch off main's newest commit instead of the old one.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "base"]);
      fork(s, "feature", "main");
      // feature does some work
      checkout(s, "feature");
      pushCommit(s, "feat: list view", "feature");
      // main does work in parallel
      checkout(s, "main");
      pushCommit(s, "main: hotfix", "main");
      // feature continues
      checkout(s, "feature");
      pushCommit(s, "feat: form view", "feature");
      // Land on feature, ready to rebase.
      return s;
    },
    isComplete: (s) => isFastForwardOf(s, "feature", "main"),
    successNote:
      "Rebase is great for cleaning up your local branch before merging. Golden rule: never rebase commits you've already pushed and shared.",
  },

  {
    id: "h6-cherry-pick",
    stage: "history",
    title: "Cherry-pick a single commit",
    difficulty: "advanced",
    blurb: "Copy one specific commit from another branch onto yours.",
    concept:
      "Sometimes you want just ONE commit from another branch — not the whole branch. `git cherry-pick <sha>` copies a single commit (or a range) onto your current branch. The copy gets a new SHA because the parent is different.",
    goal:
      "You're on main. Cherry-pick the 'critical security fix' commit from the `hotfix` branch.",
    hints: [
      "First, find the SHA: git log hotfix",
      "Then: git cherry-pick <sha>",
      "The commit appears on main, marked as cherry-picked.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "feature work"]);
      fork(s, "hotfix", "main");
      checkout(s, "hotfix");
      pushSequence(s, "hotfix", ["wip on hotfix", "critical security fix"]);
      checkout(s, "main");
      return s;
    },
    isComplete: (s) => {
      if (!headIsAt(s, "main")) return false;
      const tip = s.branches["main"];
      const c = s.commits.find((x) => x.id === tip);
      return !!c && c.msg.toLowerCase().includes("critical security fix");
    },
    successNote:
      "Cherry-pick is the right tool for backporting fixes from a development branch to a stable release branch.",
  },

  {
    id: "h7-revert",
    stage: "history",
    title: "Revert: undo a commit safely",
    difficulty: "intermediate",
    blurb:
      "Revert creates a new commit that undoes a previous one. Safe for shared history.",
    concept:
      "Unlike `reset` which rewrites history, `revert` ADDS a new commit that does the opposite of the one you're reverting. The bad commit stays in history; a new 'undo' commit follows it. This is the safe way to undo something you've already pushed.",
    goal: "Revert the 'bad commit'. A new commit named 'Revert ...' should appear at the tip.",
    hints: [
      "First, find the SHA of the bad commit: git log",
      "Then: git revert <sha>",
      "Or shorthand for the most recent commit: git revert HEAD",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "good feature", "bad commit"]);
      return s;
    },
    isComplete: (s) => {
      const tip = s.branches["main"];
      const c = s.commits.find((x) => x.id === tip);
      return !!c && c.msg.toLowerCase().startsWith("revert");
    },
    successNote:
      "Use revert (not reset) on any branch others depend on. Reset rewrites history — revert respects it.",
  },

  {
    id: "h8-interactive-rebase",
    stage: "history",
    title: "Interactive rebase (concept)",
    difficulty: "advanced",
    blurb:
      "`git rebase -i` lets you reorder, squash, edit, or drop commits.",
    concept:
      "Interactive rebase is git's power tool for cleaning up your branch before sharing. You give it a starting point, git opens an editor listing every commit since then, and you can mark each one to: pick (keep), reword (change message), squash (combine into previous), drop (delete), or edit (pause to modify). This simulator surfaces the command but doesn't open an editor.",
    goal: "Run `git rebase -i HEAD~3` to see the interactive-rebase invocation.",
    hints: ["git rebase -i HEAD~3", "Real git would open an editor with the last 3 commits listed."],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "draft", "WIP", "WIP 2", "final"]);
      return s;
    },
    isComplete: (s) => s.lastAction?.kind === "inspect",
    successNote:
      "Interactive rebase is the single most powerful history-cleanup tool. Master it and your PRs will tell clean stories instead of showing every false start.",
  },

  // ═══════════════════════════════════════════════════════
  // STAGE 4 — COLLABORATION (8 lessons)
  // ═══════════════════════════════════════════════════════

  {
    id: "c1-clone",
    stage: "collaboration",
    title: "Clone a remote repository",
    difficulty: "beginner",
    blurb: "`git clone <url>` copies a remote repo to your machine.",
    concept:
      "Cloning downloads the entire history of a remote repository, sets up a `remote` called `origin` pointing back at it, and checks out the default branch. After cloning, your local repo knows where it came from and can push/pull updates.",
    goal: "Clone a repository. Use the URL `https://github.com/example/sandbox.git`.",
    hints: [
      "git clone https://github.com/example/sandbox.git",
      "Notice the canvas seeds an initial commit, sets origin/main, and HEAD lands on main.",
    ],
    setup: () => fresh(),
    isComplete: (s) =>
      s.inited &&
      Object.keys(s.remotes).length > 0 &&
      Object.keys(s.remoteBranches).length > 0,
    successNote:
      "Real git fetches the actual file content and commit graph. This simulator stubs a single commit, but the data model is the same.",
  },

  {
    id: "c2-remote-add",
    stage: "collaboration",
    title: "Add a remote",
    difficulty: "beginner",
    blurb:
      "If you started locally, add a remote to push your work somewhere.",
    concept:
      "`git remote add <name> <url>` registers a remote nickname pointing at a URL. The convention is to call your main remote `origin`. After adding it, you can fetch/push/pull against it. A repo can have multiple remotes (e.g. `origin` and `upstream` in a fork workflow).",
    goal: "Add a remote called `origin` pointing at `https://github.com/me/repo.git`.",
    hints: [
      "git remote add origin https://github.com/me/repo.git",
      "Verify with: git remote -v",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial commit"]);
      return s;
    },
    isComplete: (s) => !!s.remotes["origin"],
    successNote:
      "A remote is just a named URL. Adding one doesn't transfer any data — fetch/pull/push do that.",
  },

  {
    id: "c3-push-first",
    stage: "collaboration",
    title: "Push your first commits",
    difficulty: "beginner",
    blurb: "`git push -u origin main` uploads commits and sets tracking.",
    concept:
      "Push sends your local commits to a remote. The first time you push a branch, use `-u` (short for `--set-upstream`) to remember the connection. After that, plain `git push` knows where to send.",
    goal: "Push the current branch to origin with the `-u` flag.",
    hints: [
      "git push -u origin main",
      "The origin/main faded label appears on the canvas, glowing briefly to signal the push.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "feature work"]);
      s.remotes["origin"] = "https://github.com/me/repo.git";
      return s;
    },
    isComplete: (s) =>
      s.remoteBranches["origin/main"] === s.branches["main"],
    successNote:
      "Tracking branches save you typing. After `-u`, future pushes/pulls don't need to specify the remote.",
  },

  {
    id: "c4-fetch",
    stage: "collaboration",
    title: "Fetch remote updates",
    difficulty: "intermediate",
    blurb:
      "`git fetch` downloads remote commits without merging them.",
    concept:
      "Fetch is the safe 'check what's new on the remote' command. It updates your remote-tracking branches (like `origin/main`) but doesn't touch your local branches. After fetching, you can see what's new with `git log main..origin/main`, then decide whether to merge or rebase.",
    goal: "Fetch from origin.",
    hints: [
      "git fetch",
      "The remote-tracking labels (origin/*) glow green briefly to confirm the fetch.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "local work"]);
      s.remotes["origin"] = "https://github.com/me/repo.git";
      return s;
    },
    isComplete: (s) => s.lastAction?.kind === "fetch",
    successNote:
      "Always fetch before reasoning about whether to pull. It updates your knowledge of the remote without changing your working state.",
  },

  {
    id: "c5-pull",
    stage: "collaboration",
    title: "Pull: fetch + merge in one step",
    difficulty: "intermediate",
    blurb:
      "`git pull` is `git fetch` followed by `git merge`. Convenient but can surprise.",
    concept:
      "Pull is a shortcut. It downloads remote changes AND merges them into your current branch. If you've made local commits and the remote also moved, pull creates a merge commit (or rebases, if you used `--rebase`). Some teams configure git to always rebase on pull for cleaner history.",
    goal: "Pull from origin.",
    hints: ["git pull"],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "shared base"]);
      s.remotes["origin"] = "https://github.com/me/repo.git";
      s.remoteBranches["origin/main"] = s.branches["main"];
      return s;
    },
    isComplete: (s) => s.lastAction?.kind === "pull",
    successNote:
      "Tip: `git pull --rebase` is the cleaner default. It avoids merge commits when you've just been working alongside someone else.",
  },

  {
    id: "c6-push-after-commits",
    stage: "collaboration",
    title: "Push new commits",
    difficulty: "beginner",
    blurb: "After committing locally, push to share with the team.",
    concept:
      "Once you've made local commits, push uploads them to the remote. Git only pushes new commits — anything the remote already has is skipped. If the remote has commits you don't (someone else pushed first), git refuses; you'll need to pull first.",
    goal: "Push the new local commits to origin.",
    hints: ["git push"],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "shared"]);
      s.remotes["origin"] = "https://github.com/me/repo.git";
      s.remoteBranches["origin/main"] = s.branches["main"];
      // Local has moved ahead.
      pushSequence(s, "main", ["new local commit"]);
      return s;
    },
    isComplete: (s) =>
      s.remoteBranches["origin/main"] === s.branches["main"] &&
      commitCountOnBranch(s, "main") === 3,
    successNote:
      "Push is your 'I'm done, share this' moment. Always good to run tests locally before pushing.",
  },

  {
    id: "c7-force-with-lease",
    stage: "collaboration",
    title: "Force push (safely)",
    difficulty: "advanced",
    blurb:
      "After rewriting history, you need to force push — but use --force-with-lease.",
    concept:
      "If you rebased or amended a commit you'd already pushed, plain `git push` is rejected because the remote's history conflicts with yours. `--force` overwrites the remote. The safer `--force-with-lease` only overwrites if no one else pushed in the meantime — so you don't accidentally clobber a teammate's work.",
    goal: "Force push the rewritten history with `--force`.",
    hints: [
      "git push --force",
      "In real teams, prefer: git push --force-with-lease (this simulator treats them the same).",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "old commit"]);
      s.remotes["origin"] = "https://github.com/me/repo.git";
      s.remoteBranches["origin/main"] = s.branches["main"];
      // Local rewrote history.
      s.commits[1].msg = "old commit (amended)";
      return s;
    },
    isComplete: (s) => s.lastAction?.kind === "push",
    successNote:
      "Force push is your 'I really mean it' switch. Only use it on branches you own (your feature branches), never on shared branches like main.",
  },

  {
    id: "c8-pr-workflow",
    stage: "collaboration",
    title: "The full PR workflow",
    difficulty: "intermediate",
    blurb:
      "Branch → commit → push → open PR. The standard team workflow.",
    concept:
      "Most professional teams use the same workflow: create a branch for your task, make commits, push the branch to origin, open a Pull Request on GitHub/GitLab for review, address feedback by pushing more commits, then merge. This lesson walks through the local-git parts.",
    goal:
      "Create a branch called `fix/typo`, make a commit, then push it to origin with `-u`.",
    hints: [
      "git switch -c fix/typo",
      'git add . then git commit -m "fix typo"',
      "git push -u origin fix/typo",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "current"]);
      s.remotes["origin"] = "https://github.com/me/repo.git";
      s.remoteBranches["origin/main"] = s.branches["main"];
      s.working = ["docs/typo.md"];
      return s;
    },
    isComplete: (s) =>
      hasBranch(s, "fix/typo") &&
      headIsAt(s, "fix/typo") &&
      commitCountOnBranch(s, "fix/typo") > commitCountOnBranch(s, "main") &&
      !!s.remoteBranches["origin/fix/typo"],
    successNote:
      "This loop — branch, commit, push, PR — is what 95% of professional git use looks like. Master it and you're productive in any team.",
  },

  // ═══════════════════════════════════════════════════════
  // STAGE 5 — RECOVERY & DEBUGGING (6 lessons)
  // ═══════════════════════════════════════════════════════

  {
    id: "r1-reflog",
    stage: "recovery",
    title: "The reflog: HEAD's diary",
    difficulty: "intermediate",
    blurb:
      "Every move HEAD makes is logged. The reflog can rescue lost commits.",
    concept:
      "Git records every change to HEAD in the reflog: commits, checkouts, resets, rebases, merges — everything. Even commits 'destroyed' by a hard reset live in the reflog for ~90 days. `git reflog` is the panic button when you've lost work.",
    goal: "Run `git reflog` to view HEAD's history.",
    hints: [
      "git reflog",
      "Each entry shows the SHA HEAD pointed at and what command moved it there.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "good work", "more work"]);
      // Manually seed some reflog entries.
      s.reflog = [
        { action: "commit", desc: "more work", branch: "main", to: s.branches["main"]! },
        { action: "commit", desc: "good work", branch: "main", to: s.commits[1].id },
        { action: "commit", desc: "initial", branch: "main", to: s.commits[0].id },
      ];
      return s;
    },
    isComplete: (s) => s.lastAction?.kind === "inspect" && s.reflog.length > 0,
    successNote:
      "Anytime you think 'I lost a commit', check the reflog first. The SHA is usually right there waiting to be recovered.",
  },

  {
    id: "r2-recover-after-reset",
    stage: "recovery",
    title: "Recover after `reset --hard`",
    difficulty: "advanced",
    blurb:
      "You reset too far. Use the reflog to find the lost commit's SHA and branch back to it.",
    concept:
      "After a `reset --hard` that loses commits, the commits are unreachable via any branch — but their SHAs are still in the reflog. `git reflog` shows them. Then `git branch <name> <sha>` creates a new branch pointing back at them, rescuing the work.",
    goal:
      "Recover the lost commit by creating a branch called `recovered` pointing at the most recent commit listed in the reflog.",
    hints: [
      "git reflog — find the SHA of the commit you want.",
      "git branch recovered <sha>",
    ],
    setup: () => {
      const s = emptyInited();
      const ids = pushSequence(s, "main", [
        "initial",
        "important work",
        "more important work",
      ]);
      // Simulate that the user did a hard reset losing the last 2 commits.
      const survivor = ids[0];
      s.commits = s.commits.slice(0, 1);
      s.branches["main"] = survivor;
      // The reflog still remembers the lost SHAs.
      s.reflog = [
        {
          action: "reset --hard",
          desc: "HEAD~2",
          branch: "main",
          to: survivor,
        },
        {
          action: "commit",
          desc: "more important work",
          branch: "main",
          to: ids[2],
        },
        {
          action: "commit",
          desc: "important work",
          branch: "main",
          to: ids[1],
        },
      ];
      // Re-add the orphaned commits to S.commits so a branch can point at them.
      // (The renderer will display them once a branch references them.)
      // We don't add them here because they'd appear unreferenced — the lesson
      // expects the learner to discover the SHA from reflog output.
      return s;
    },
    // Lesson is considered complete when a 'recovered' branch exists.
    // (The simulator can't easily rehydrate the lost commits from a typed
    // SHA without re-engineering reset, so we accept any new branch.)
    isComplete: (s) => hasBranch(s, "recovered"),
    successNote:
      "Real-world tip: many lost-work disasters are recoverable with reflog + branch. The reflog is your safety net.",
  },

  {
    id: "r3-abort-merge",
    stage: "recovery",
    title: "Abort a half-done merge",
    difficulty: "intermediate",
    blurb:
      "Started a merge and want to bail? `git merge --abort` restores your state.",
    concept:
      "If a merge introduces conflicts you don't want to resolve right now, `git merge --abort` undoes the merge attempt entirely — your branch returns to where it was before you typed `git merge`. Same exists for rebase (`--abort`) and cherry-pick (`--abort`).",
    goal: "Abort the in-progress merge.",
    hints: ["git merge --abort"],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "stable"]);
      fork(s, "feature", "main");
      checkout(s, "feature");
      pushCommit(s, "experimental change", "feature");
      checkout(s, "main");
      return s;
    },
    isComplete: (s) => s.lastAction?.kind === "inspect" && headIsAt(s, "main"),
    successNote:
      "Knowing the --abort flags saves you from many 'I'm stuck in a bad state' panics.",
  },

  {
    id: "r4-abort-rebase",
    stage: "recovery",
    title: "Abort a rebase",
    difficulty: "intermediate",
    blurb: "Same idea: `git rebase --abort` cancels a rebase in progress.",
    concept:
      "Rebase replays commits one at a time. If something goes wrong partway through, you have two choices: `--continue` (after fixing the issue) or `--abort` (to give up and return to the pre-rebase state). Abort is your escape hatch.",
    goal: "Abort the in-progress rebase.",
    hints: ["git rebase --abort"],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "stable"]);
      fork(s, "feature", "main");
      checkout(s, "feature");
      pushSequence(s, "feature", ["a", "b"]);
      checkout(s, "main");
      pushCommit(s, "main moved", "main");
      checkout(s, "feature");
      return s;
    },
    isComplete: (s) => s.lastAction?.kind === "inspect",
    successNote:
      "When in doubt during a rebase, abort. You can always re-attempt with a fresh head.",
  },

  {
    id: "r5-restore-branch",
    stage: "recovery",
    title: "Restore a deleted branch",
    difficulty: "advanced",
    blurb:
      "Deleted the wrong branch? The reflog or `git fsck` can find it.",
    concept:
      "Deleting a branch only removes the label, not the commits. As long as the commits haven't been garbage-collected (usually within 90 days), you can re-create the branch by pointing a new label at the old tip SHA. Find the SHA in the reflog or via `git fsck --lost-found`.",
    goal:
      "Re-create the deleted `lost-feature` branch using `git branch lost-feature <sha>`. Use the SHA shown in the reflog.",
    hints: [
      "git reflog — look for the last entry referencing lost-feature.",
      "git branch lost-feature <sha>",
    ],
    setup: () => {
      const s = emptyInited();
      const baseIds = pushSequence(s, "main", ["initial", "base"]);
      fork(s, "lost-feature", "main");
      checkout(s, "lost-feature");
      const featTip = pushCommit(s, "important feature", "lost-feature").id;
      checkout(s, "main");
      // Simulate the user deleting the branch.
      delete s.branches["lost-feature"];
      s.reflog = [
        {
          action: "branch -d",
          desc: "lost-feature",
          branch: "main",
          to: featTip,
        },
        {
          action: "commit",
          desc: "important feature",
          branch: "lost-feature",
          to: featTip,
        },
        { action: "commit", desc: "base", branch: "main", to: baseIds[1] },
      ];
      return s;
    },
    isComplete: (s) => hasBranch(s, "lost-feature"),
    successNote:
      "The reflog is the unsung hero of git recovery. Almost nothing is truly lost for 90 days.",
  },

  {
    id: "r6-revert-on-shared",
    stage: "recovery",
    title: "Undo a pushed commit safely",
    difficulty: "advanced",
    blurb:
      "Use `revert`, not `reset`, to undo something already shared.",
    concept:
      "If a bad commit is already on the remote and others have pulled it, resetting locally then force-pushing creates chaos for your team. Instead, use `git revert <sha>` — it adds a NEW commit that does the opposite. History is preserved, and no one else has to deal with rewritten commits.",
    goal: "Revert the 'broken feature' commit.",
    hints: [
      "Find the SHA: git log",
      "git revert <sha>",
      "A new 'Revert ...' commit appears at the tip.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "good", "broken feature"]);
      s.remotes["origin"] = "https://github.com/me/repo.git";
      s.remoteBranches["origin/main"] = s.branches["main"];
      return s;
    },
    isComplete: (s) => {
      const tip = s.branches["main"];
      const c = s.commits.find((x) => x.id === tip);
      return !!c && c.msg.toLowerCase().startsWith("revert");
    },
    successNote:
      "Revert respects history. Use it on shared branches. Save reset/rebase for private branches you haven't pushed.",
  },

  // ═══════════════════════════════════════════════════════
  // STAGE 6 — ADVANCED WORKFLOWS (7 lessons)
  // ═══════════════════════════════════════════════════════

  {
    id: "a1-stash-save",
    stage: "advanced",
    title: "Stash work in progress",
    difficulty: "intermediate",
    blurb: "Set aside uncommitted changes without making a commit.",
    concept:
      "`git stash` saves your current uncommitted changes to a side-stack and reverts your working directory to a clean state. Use it when you need to quickly switch branches but aren't ready to commit. Recover later with `git stash pop` (apply + remove) or `git stash apply` (apply but keep).",
    goal:
      "Stage your changes with `git add .`, then stash them with `git stash`.",
    hints: ["git add .", "git stash"],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "stable"]);
      s.working = ["src/wip-feature.ts"];
      return s;
    },
    isComplete: (s) =>
      s.stashes.length > 0 && s.staged.length === 0 && s.working.length === 0,
    successNote:
      "Stash is your 'pause this and come back later' button. It's a stack — multiple stashes accumulate, indexed stash@{0}, stash@{1}, etc.",
  },

  {
    id: "a2-stash-pop",
    stage: "advanced",
    title: "Pop a stash",
    difficulty: "beginner",
    blurb: "`git stash pop` brings stashed changes back and removes the stash.",
    concept:
      "Pop takes the most recent stash (stash@{0}), reapplies its changes to your working directory, and removes it from the stack. If you want to keep the stash for later, use `git stash apply` instead.",
    goal: "Pop the stash.",
    hints: ["git stash pop"],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "stable"]);
      s.stashes.push({
        msg: "WIP feature work",
        branch: "main",
        commitId: s.branches["main"],
      });
      return s;
    },
    isComplete: (s) => s.stashes.length === 0,
    successNote:
      "Stash is liberating once you know it exists. No more 'oh no I made changes on the wrong branch'.",
  },

  {
    id: "a3-tag-release",
    stage: "advanced",
    title: "Tag a release",
    difficulty: "beginner",
    blurb: "Tags are immovable labels — perfect for releases.",
    concept:
      "Unlike branches (which move with new commits), tags are fixed: once placed, they always point at the same commit. Use them to mark releases (v1.0, v2.3.1) or any historical moment you want to bookmark. Annotated tags (`-a`) carry a message and the tagger's identity.",
    goal: 'Create an annotated tag called `v1.0` with the message "first release".',
    hints: [
      'git tag -a v1.0 -m "first release"',
      "The tag label appears in purple on the canvas.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "ship-ready"]);
      return s;
    },
    isComplete: (s) =>
      Object.prototype.hasOwnProperty.call(s.tags, "v1.0") &&
      s.tags["v1.0"].annotated,
    successNote:
      "Annotated tags > lightweight tags for releases. They store who tagged and why, which matters for audit trails.",
  },

  {
    id: "a4-detached-head",
    stage: "advanced",
    title: "Detached HEAD: time-travel",
    difficulty: "advanced",
    blurb:
      "Checking out a commit by SHA (not a branch) puts HEAD in a detached state.",
    concept:
      "Branches make HEAD 'follow' new commits. When you check out a SHA directly, HEAD is detached — pointing at a specific commit, not a branch. New commits in this state don't belong to any branch. It's safe for browsing history; risky if you commit and switch away (those commits become orphans).",
    goal: "Check out the very first commit by its short SHA. HEAD should detach.",
    hints: [
      "git log — find the first commit's short SHA.",
      "git checkout <sha>",
      "The canvas labels the commit 'HEAD (detached)'.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "v0.1", "v0.2", "v0.3"]);
      return s;
    },
    isComplete: (s) => {
      if (!s.detached) return false;
      const first = s.commits[0];
      return !!first && s.HEAD === first.id;
    },
    successNote:
      "If you make commits in detached HEAD and want to keep them, create a branch first: `git switch -c new-branch`. Otherwise they're orphans.",
  },

  {
    id: "a5-cherry-pick-range",
    stage: "advanced",
    title: "Cherry-pick a range",
    difficulty: "advanced",
    blurb: "Cherry-pick multiple commits at once with `<from>..<to>`.",
    concept:
      "Cherry-pick accepts a range: `git cherry-pick <from>..<to>` replays every commit AFTER `<from>` up to and INCLUDING `<to>` onto your current branch. Useful when porting a series of fixes from one branch to another.",
    goal:
      "Cherry-pick the range from commit 'a' to commit 'c' on the `release` branch onto main.",
    hints: [
      "git log release — find the SHAs of commits 'a' and 'c'.",
      "git cherry-pick <sha-of-a>..<sha-of-c>",
      "Note: <a>..<c> is exclusive of 'a', inclusive of 'c' — so 'b' and 'c' are copied.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "current main"]);
      fork(s, "release", "main");
      checkout(s, "release");
      pushSequence(s, "release", ["a", "b", "c", "d"]);
      checkout(s, "main");
      return s;
    },
    isComplete: (s) => {
      // Main should have grown by 2 cherry-picked commits.
      const mainCommits = commitCountOnBranch(s, "main");
      return mainCommits >= 4;
    },
    successNote:
      "Backporting a stretch of fixes from main to a release branch is the canonical use of cherry-pick ranges.",
  },

  {
    id: "a6-bisect-concept",
    stage: "advanced",
    title: "Bisect: binary-search for the bug",
    difficulty: "advanced",
    blurb:
      "When did this break? `git bisect` does a binary search through history.",
    concept:
      "`git bisect` automates the 'when did this bug appear?' hunt. You mark one commit as 'good' (works) and one as 'bad' (broken), and git checks out the midpoint. You test, mark it good or bad, and git narrows the range. After log₂(n) steps, git tells you exactly which commit introduced the bug. (This simulator surfaces the concept rather than the workflow.)",
    goal: "Run `git log` to inspect the commit history where a bug might live.",
    hints: [
      "git log",
      "In real git: git bisect start, then git bisect good <old-sha>, then git bisect bad <new-sha>.",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", [
        "v1.0",
        "feature A",
        "feature B",
        "refactor",
        "feature C",
        "bug introduced here somewhere",
        "feature D",
        "BUG REPORT",
      ]);
      return s;
    },
    isComplete: (s) => s.lastAction?.kind === "inspect" && s.commits.length >= 8,
    successNote:
      "Bisect is magic for finding regressions in large codebases. You can automate it with a test script: `git bisect run ./test.sh`.",
  },

  {
    id: "a7-clean-history-pr",
    stage: "advanced",
    title: "Ship a clean PR: rebase + tag",
    difficulty: "advanced",
    blurb:
      "Combine techniques: rebase your branch onto main, then tag the release.",
    concept:
      "Professional git workflows combine many tools. A common end-to-end flow: make commits on a feature branch, rebase onto the latest main, fast-forward merge to main, then tag the new release. This lesson exercises that full chain.",
    goal:
      "On `feature`, rebase onto main. Then switch to main, merge (fast-forward), and tag the result as `v2.0`.",
    hints: [
      "git rebase main (while on feature)",
      "git switch main",
      "git merge feature",
      "git tag v2.0",
    ],
    setup: () => {
      const s = emptyInited();
      pushSequence(s, "main", ["initial", "v1.0 release"]);
      fork(s, "feature", "main");
      checkout(s, "feature");
      pushCommit(s, "feat: new module", "feature");
      checkout(s, "main");
      pushCommit(s, "main: hotfix after v1", "main");
      checkout(s, "feature");
      pushCommit(s, "feat: wire it up", "feature");
      return s;
    },
    isComplete: (s) =>
      headIsAt(s, "main") &&
      Object.prototype.hasOwnProperty.call(s.tags, "v2.0") &&
      s.branches["main"] === s.tags["v2.0"].commitId,
    successNote:
      "Rebase before merge gives clean linear history. Tag the result so you can reference the release forever.",
  },
];

// ─── QUIZZES ───────────────────────────────────────────────

export const QUIZZES: Quiz[] = [
  // Foundations
  {
    id: "q-f-staging-area",
    stage: "foundations",
    topic: "The staging area",
    difficulty: "beginner",
    scenario:
      "You edit a file and run `git commit -m \"fix\"` without staging.",
    question: "What happens?",
    options: [
      {
        label: "Git refuses — nothing was staged, so there's nothing to commit.",
        correct: true,
        explanation:
          "Commits operate on the staging area, not the working directory. You need to `git add` first (or use `git commit -a` to auto-stage tracked files).",
      },
      {
        label: "Git commits all your working-directory changes automatically.",
        correct: false,
        explanation: "Only `git commit -a` does that — and only for already-tracked files.",
      },
      {
        label: "Git commits an empty snapshot.",
        correct: false,
        explanation: "Git refuses to make empty commits unless you pass `--allow-empty`.",
      },
    ],
  },
  {
    id: "q-f-snapshots-vs-diffs",
    stage: "foundations",
    topic: "Snapshots vs diffs",
    difficulty: "intermediate",
    scenario: "You're explaining git internals to a teammate.",
    question: "What does each commit store?",
    options: [
      {
        label: "A complete snapshot of every tracked file at that moment.",
        correct: true,
        explanation:
          "Git stores snapshots, not diffs. Diffs are computed on the fly. (Internally, identical files are deduplicated via content-addressable storage — but conceptually, each commit is a full snapshot.)",
      },
      {
        label: "Only the diff from the previous commit.",
        correct: false,
        explanation:
          "Many version control systems work that way, but git doesn't. Snapshots make many operations (like switching branches) much faster.",
      },
      {
        label: "A reference to the commit before it.",
        correct: false,
        explanation: "Commits do reference their parents, but they also store a full snapshot of the tree.",
      },
    ],
  },

  // Branching
  {
    id: "q-b-fast-forward",
    stage: "branching",
    topic: "Fast-forward eligibility",
    difficulty: "beginner",
    scenario:
      "main is at commit A. feature branched from A and added B, C. main hasn't moved.",
    setup: () => {
      const s = emptyInited();
      const a = pushCommit(s, "A", "main");
      fork(s, "feature", "main");
      checkout(s, "feature");
      pushCommit(s, "B", "feature", [a.id]);
      pushCommit(s, "C", "feature");
      checkout(s, "main");
      return s;
    },
    question: "You run `git merge feature` on main. What happens?",
    options: [
      {
        label: "Main fast-forwards to C. No merge commit.",
        correct: true,
        explanation:
          "Main is an ancestor of feature, so git can move main's label forward. That's a fast-forward.",
      },
      {
        label: "A merge commit with two parents is created.",
        correct: false,
        explanation: "Only happens when histories have actually diverged. Here main is strictly behind feature.",
      },
      {
        label: "Merge fails — no common ancestor.",
        correct: false,
        explanation: "A is the common ancestor.",
      },
    ],
  },
  {
    id: "q-b-no-ff-purpose",
    stage: "branching",
    topic: "Why use --no-ff?",
    difficulty: "intermediate",
    scenario:
      "Your team wants every feature branch to leave a visible mark in main's history.",
    question: "Which merge strategy fits?",
    options: [
      {
        label: "`git merge --no-ff feature` — forces a merge commit every time.",
        correct: true,
        explanation:
          "The merge commit preserves the branch topology even when fast-forward would have been possible. Lets you see 'this work happened on a branch' in `git log`.",
      },
      {
        label: "Default `git merge feature` — fastest.",
        correct: false,
        explanation: "Default fast-forwards when possible, erasing the branch's existence from main's history.",
      },
      {
        label: "`git rebase feature` then merge.",
        correct: false,
        explanation:
          "Rebase erases the branch topology even more thoroughly. Opposite of what you want.",
      },
    ],
  },

  // History rewriting
  {
    id: "q-h-rebase-rewrites",
    stage: "history",
    topic: "Rebase and SHAs",
    difficulty: "intermediate",
    scenario:
      "main has A → B → C. feature branched at B and added X, Y. You rebase feature onto main.",
    question: "What's true about X and Y after the rebase?",
    options: [
      {
        label: "They get new SHAs (X' and Y') because their parents changed.",
        correct: true,
        explanation:
          "A commit's SHA is a hash of its content AND its parent. New parent = new SHA. The original X and Y are now unreferenced and will be garbage-collected.",
      },
      {
        label: "They keep their original SHAs.",
        correct: false,
        explanation: "SHAs are content-addressed. Different parent = different SHA.",
      },
      {
        label: "Only Y gets a new SHA; X stays the same.",
        correct: false,
        explanation: "If X's parent changed (from B to C), X's SHA changes. And Y's parent is X, so Y also changes.",
      },
    ],
  },
  {
    id: "q-h-reset-hard-danger",
    stage: "history",
    topic: "`reset --hard` consequences",
    difficulty: "advanced",
    scenario: "You have 3 unpushed commits AND uncommitted working-directory changes.",
    question: "You run `git reset --hard HEAD~3`. What happens?",
    options: [
      {
        label: "The 3 commits are removed AND uncommitted changes are wiped.",
        correct: true,
        explanation:
          "--hard discards everything past the target. Commits can be recovered via reflog for ~90 days. Working changes are gone for good unless you stashed first.",
      },
      {
        label: "Only the commits are removed; working changes are kept.",
        correct: false,
        explanation: "That's --mixed (the default with no flag), not --hard.",
      },
      {
        label: "Git refuses because of uncommitted changes.",
        correct: false,
        explanation: "--hard ignores and overwrites uncommitted changes. That's the danger.",
      },
    ],
  },
  {
    id: "q-h-revert-vs-reset",
    stage: "history",
    topic: "Revert vs reset",
    difficulty: "advanced",
    scenario:
      "You committed and pushed a buggy change. Three teammates already pulled.",
    question: "How do you undo it?",
    options: [
      {
        label: "`git revert <sha>` — adds a new commit that reverses the change.",
        correct: true,
        explanation:
          "Revert preserves history. Your teammates pull the new revert commit and their state stays consistent. Safe on shared branches.",
      },
      {
        label: "`git reset --hard HEAD~1` then `git push --force`.",
        correct: false,
        explanation:
          "Force-pushing rewritten history to a shared branch creates chaos for teammates. Their next pull will conflict in confusing ways.",
      },
      {
        label: "`git checkout HEAD~1` then `git push`.",
        correct: false,
        explanation:
          "Checkout doesn't move the branch — it detaches HEAD. The push wouldn't change anything on the remote.",
      },
    ],
  },

  // Collaboration
  {
    id: "q-c-fetch-vs-pull",
    stage: "collaboration",
    topic: "Fetch vs pull",
    difficulty: "intermediate",
    scenario:
      "You want to see if the remote has new commits, but you're not ready to integrate them.",
    question: "Which command?",
    options: [
      {
        label: "`git fetch` — downloads updates without touching your branches.",
        correct: true,
        explanation:
          "Fetch updates remote-tracking branches (origin/*) but leaves your local branches alone. Safe inspection.",
      },
      {
        label: "`git pull` — same thing.",
        correct: false,
        explanation: "Pull is fetch + merge. It modifies your current branch.",
      },
      {
        label: "`git status` — checks the remote.",
        correct: false,
        explanation: "Status only inspects local state; it doesn't talk to the remote.",
      },
    ],
  },
  {
    id: "q-c-force-with-lease",
    stage: "collaboration",
    topic: "Safe force push",
    difficulty: "advanced",
    scenario:
      "You rebased your feature branch and need to push the rewritten history.",
    question: "Which is the safest force-push variant?",
    options: [
      {
        label: "`git push --force-with-lease` — refuses if anyone else pushed.",
        correct: true,
        explanation:
          "--force-with-lease checks that the remote's current state matches what you last fetched. If a teammate pushed in the meantime, the push is rejected — you won't accidentally clobber their work.",
      },
      {
        label: "`git push --force` — always works.",
        correct: false,
        explanation: "Yes, it always works — including overwriting your teammate's just-pushed commits.",
      },
      {
        label: "`git push origin :main` — clears it.",
        correct: false,
        explanation: "That syntax deletes the remote branch, which is rarely what you want.",
      },
    ],
  },

  // Recovery
  {
    id: "q-r-reflog-rescue",
    stage: "recovery",
    topic: "The reflog",
    difficulty: "advanced",
    scenario:
      "You ran `git reset --hard HEAD~5` and want the commits back.",
    question: "What's your first move?",
    options: [
      {
        label: "`git reflog` to find the lost commits' SHAs, then create a branch pointing at one.",
        correct: true,
        explanation:
          "Reflog records every HEAD change for ~90 days. The SHAs are still there. `git branch rescue <sha>` brings them back.",
      },
      {
        label: "It's gone. Reset is irreversible.",
        correct: false,
        explanation: "Reset is reversible for ~90 days via the reflog. Don't panic.",
      },
      {
        label: "Pull from the remote to get them back.",
        correct: false,
        explanation: "Only works if you'd pushed those commits. Often you haven't.",
      },
    ],
  },

  // Advanced
  {
    id: "q-a-stash-pop-apply",
    stage: "advanced",
    topic: "Stash pop vs apply",
    difficulty: "beginner",
    scenario: "You have a stash you want to test on multiple branches.",
    question: "Which command should you use?",
    options: [
      {
        label: "`git stash apply` — applies but keeps the stash for reuse.",
        correct: true,
        explanation:
          "Apply leaves the stash in the stack so you can apply it elsewhere. Pop deletes it after applying.",
      },
      {
        label: "`git stash pop` — same thing.",
        correct: false,
        explanation: "Pop removes the stash after applying. You'd only get to use it once.",
      },
      {
        label: "`git stash branch <name>` — applies as a new branch.",
        correct: false,
        explanation:
          "That's useful for resuming work but creates a branch, which isn't what you want for testing across multiple branches.",
      },
    ],
  },
  {
    id: "q-a-detached-commit",
    stage: "advanced",
    topic: "Commits in detached HEAD",
    difficulty: "advanced",
    scenario:
      "You ran `git checkout abc1234` and made a new commit. Now you switch back to main.",
    question: "What happens to that commit?",
    options: [
      {
        label:
          "It becomes unreachable. No branch points at it, so it'll be garbage-collected.",
        correct: true,
        explanation:
          "Branches anchor commits. Without one, the commit drifts. Rescue it BEFORE switching with `git branch <name> HEAD`. The warning git prints when you switch is trying to tell you exactly this.",
      },
      {
        label: "main automatically includes it.",
        correct: false,
        explanation: "Main only moves when you commit while on main.",
      },
      {
        label: "Git refuses to let you switch.",
        correct: false,
        explanation: "Git warns you but lets you switch. Many beginners lose work this way.",
      },
    ],
  },
];

// ─── Stage helpers ─────────────────────────────────────────
export function lessonsInStage(stageId: StageId): Lesson[] {
  return LESSONS.filter((l) => l.stage === stageId);
}

export function quizzesInStage(stageId: StageId): Quiz[] {
  return QUIZZES.filter((q) => q.stage === stageId);
}

// A stage is unlocked when all prior stages meet UNLOCK_THRESHOLD completion.
export function isStageUnlocked(
  stageId: StageId,
  completedLessonIds: string[],
): boolean {
  const target = STAGES.find((s) => s.id === stageId);
  if (!target) return false;
  if (target.order === 1) return true; // first stage always open

  for (const stage of STAGES) {
    if (stage.order >= target.order) continue;
    const stageLessons = lessonsInStage(stage.id);
    if (stageLessons.length === 0) continue;
    const done = stageLessons.filter((l) =>
      completedLessonIds.includes(l.id),
    ).length;
    if (done / stageLessons.length < UNLOCK_THRESHOLD) return false;
  }
  return true;
}

export function stageProgress(
  stageId: StageId,
  completedLessonIds: string[],
  completedQuizIds: string[],
): { lessons: { done: number; total: number }; quizzes: { done: number; total: number } } {
  const lessons = lessonsInStage(stageId);
  const quizzes = quizzesInStage(stageId);
  return {
    lessons: {
      done: lessons.filter((l) => completedLessonIds.includes(l.id)).length,
      total: lessons.length,
    },
    quizzes: {
      done: quizzes.filter((q) => completedQuizIds.includes(q.id)).length,
      total: quizzes.length,
    },
  };
}

// ─── Persistence ───────────────────────────────────────────
const PROGRESS_KEY = "gitviz:lesson-progress";

export type Progress = {
  completedLessons: string[];
  completedQuizzes: string[];
};

export function loadProgress(): Progress {
  if (typeof window === "undefined")
    return { completedLessons: [], completedQuizzes: [] };
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { completedLessons: [], completedQuizzes: [] };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      completedLessons: Array.isArray(parsed.completedLessons)
        ? parsed.completedLessons
        : [],
      completedQuizzes: Array.isArray(parsed.completedQuizzes)
        ? parsed.completedQuizzes
        : [],
    };
  } catch {
    return { completedLessons: [], completedQuizzes: [] };
  }
}

export function saveProgress(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function markLessonComplete(id: string): Progress {
  const p = loadProgress();
  if (!p.completedLessons.includes(id)) p.completedLessons.push(id);
  saveProgress(p);
  return p;
}

export function markQuizComplete(id: string): Progress {
  const p = loadProgress();
  if (!p.completedQuizzes.includes(id)) p.completedQuizzes.push(id);
  saveProgress(p);
  return p;
}
