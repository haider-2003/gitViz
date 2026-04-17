export const CMDS: string[] = [
  "git init",
  "git clone ",
  "git add .",
  "git add -p",
  "git restore --staged ",
  "git restore ",
  'git commit -m ""',
  'git commit --amend -m ""',
  "git commit --amend --no-edit",
  'git commit -am ""',
  "git branch",
  "git branch -v",
  "git branch --merged",
  "git branch --no-merged",
  "git branch -d ",
  "git branch -D ",
  "git branch -m ",
  "git checkout ",
  "git checkout -b ",
  "git switch ",
  "git switch -c ",
  "git switch -",
  "git merge ",
  "git merge --no-ff ",
  "git merge --squash ",
  "git merge --abort",
  "git rebase ",
  "git rebase -i HEAD~",
  "git rebase --abort",
  "git rebase --continue",
  "git cherry-pick ",
  "git stash",
  "git stash list",
  "git stash pop",
  "git stash apply ",
  "git stash drop ",
  "git stash clear",
  "git stash show",
  "git stash branch ",
  'git stash push -m ""',
  "git reset HEAD~1",
  "git reset --soft HEAD~",
  "git reset --mixed HEAD~",
  "git reset --hard HEAD~",
  "git revert HEAD",
  "git revert ",
  "git tag",
  'git tag -a  -m ""',
  "git tag -d ",
  "git tag ",
  "git log",
  "git log --oneline",
  "git log --graph",
  "git log --oneline --graph",
  "git log -n ",
  "git status",
  "git diff",
  "git show HEAD",
  "git show ",
  "git reflog",
  "git shortlog",
  "git blame ",
  "git remote -v",
  "git remote add origin ",
  "git remote remove ",
  "git fetch",
  "git pull",
  "git pull --rebase",
  "git push",
  "git push -u origin ",
  "git push --force",
  'git config user.name ""',
  'git config user.email ""',
  "git config --list",
  "clear",
  "reset",
  "help",
];

export type HelpCmd = { code: string; desc: string; accent?: string };
export type HelpSection = { label: string; rows: [HelpCmd, HelpCmd][] };

// Each row has two cells (matching original two-column layout).
// Wrap a part of the code string in {angle-bracket} to render it accent-blue.
export const HELP_SECTIONS: HelpSection[] = [
  {
    label: "Setup",
    rows: [
      [
        { code: "git init", desc: "Initialize new repository" },
        { code: "git clone {<url>}", desc: "Simulate cloning a repo" },
      ],
    ],
  },
  {
    label: "Staging & Committing",
    rows: [
      [
        { code: "git add {<file>}", desc: "Stage a file (use . for all)" },
        { code: "git add -p", desc: "Interactive staging (simulated)" },
      ],
      [
        { code: "git restore {--staged} <f>", desc: "Unstage a file" },
        { code: "git restore {<file>}", desc: "Discard working changes" },
      ],
      [
        { code: 'git commit {-m} "msg"', desc: "Create a commit" },
        { code: 'git commit {-am} "msg"', desc: "Stage all tracked + commit" },
      ],
      [
        { code: 'git commit {--amend} -m "msg"', desc: "Amend last commit message" },
        { code: "git commit {--amend --no-edit}", desc: "Amend without changing message" },
      ],
    ],
  },
  {
    label: "Branches",
    rows: [
      [
        { code: "git branch", desc: "List all branches" },
        { code: "git branch {-v}", desc: "List with last commit info" },
      ],
      [
        { code: "git branch {<name>}", desc: "Create a branch" },
        { code: "git branch {-m} <old> <new>", desc: "Rename a branch" },
      ],
      [
        { code: "git branch {-d} <name>", desc: "Delete merged branch" },
        { code: "git branch {-D} <name>", desc: "Force delete branch" },
      ],
      [
        { code: "git branch {--merged}", desc: "Branches merged into HEAD" },
        { code: "git branch {--no-merged}", desc: "Branches not yet merged" },
      ],
    ],
  },
  {
    label: "Checkout & Switch",
    rows: [
      [
        { code: "git checkout {<branch>}", desc: "Switch to branch" },
        { code: "git checkout {-b} <name>", desc: "Create and switch" },
      ],
      [
        { code: "git switch {<branch>}", desc: "Switch branch (modern)" },
        { code: "git switch {-c} <name>", desc: "Create and switch (modern)" },
      ],
      [
        { code: "git switch {-}", desc: "Switch to previous branch" },
        { code: "git checkout {<commit-id>}", desc: "Detach HEAD to commit" },
      ],
    ],
  },
  {
    label: "Merge & Rebase",
    rows: [
      [
        { code: "git merge {<branch>}", desc: "Merge (fast-forward or commit)" },
        { code: "git merge {--no-ff} <branch>", desc: "Always create merge commit" },
      ],
      [
        { code: "git merge {--squash} <branch>", desc: "Squash into one staged change" },
        { code: "git merge {--abort}", desc: "Abort in-progress merge" },
      ],
      [
        { code: "git rebase {<branch>}", desc: "Rebase current onto branch" },
        { code: "git rebase {-i} HEAD~<n>", desc: "Interactive rebase (simulated)" },
      ],
      [
        { code: "git cherry-pick {<id>}", desc: "Copy commit onto current branch" },
        { code: "git cherry-pick {<a>..<b>}", desc: "Copy a range of commits" },
      ],
    ],
  },
  {
    label: "Stash",
    rows: [
      [
        { code: "git stash", desc: "Stash working changes" },
        { code: 'git stash {push -m} "msg"', desc: "Stash with a label" },
      ],
      [
        { code: "git stash {list}", desc: "List all stashes" },
        { code: "git stash {pop}", desc: "Apply + drop top stash" },
      ],
      [
        { code: "git stash {apply} stash@{n}", desc: "Apply without dropping" },
        { code: "git stash {drop / clear}", desc: "Remove stash(es)" },
      ],
      [
        { code: "git stash {branch} <name>", desc: "Create branch from stash" },
        { code: "git stash {show}", desc: "Show stash contents" },
      ],
    ],
  },
  {
    label: "Reset & Revert",
    rows: [
      [
        { code: "git reset {HEAD~1}", desc: "Undo last commit (mixed)" },
        { code: "git reset {--soft} HEAD~<n>", desc: "Move HEAD back, keep staged" },
      ],
      [
        { code: "git reset {--mixed} HEAD~<n>", desc: "Unstage changes (default)" },
        { code: "git reset {--hard} HEAD~<n>", desc: "Discard commits + changes" },
      ],
      [
        { code: "git revert {<id>}", desc: "New commit undoing a commit" },
        { code: "git revert {HEAD}", desc: "Revert last commit" },
      ],
    ],
  },
  {
    label: "Tags",
    rows: [
      [
        { code: "git tag {<name>}", desc: "Lightweight tag at HEAD" },
        { code: 'git tag {-a} <n> {-m} "msg"', desc: "Annotated tag" },
      ],
      [
        { code: "git tag {<name> <commit-id>}", desc: "Tag a specific commit" },
        { code: "git tag {-d} <name>", desc: "Delete a tag" },
      ],
    ],
  },
  {
    label: "Inspection",
    rows: [
      [
        { code: "git log", desc: "Full commit history" },
        { code: "git log {--oneline --graph}", desc: "Compact graph view" },
      ],
      [
        { code: "git status", desc: "Working tree status" },
        { code: "git diff", desc: "Show unstaged changes" },
      ],
      [
        { code: "git show {<id>}", desc: "Show commit details" },
        { code: "git reflog", desc: "Full HEAD movement history" },
      ],
      [
        { code: "git shortlog", desc: "Commits grouped by author" },
        { code: "git blame {<file>}", desc: "Who changed what (simulated)" },
      ],
    ],
  },
  {
    label: "Remote (Simulated)",
    rows: [
      [
        { code: "git remote {add} origin <url>", desc: "Add a remote" },
        { code: "git remote {-v}", desc: "List remotes" },
      ],
      [
        { code: "git fetch / pull / push", desc: "Remote sync (simulated)" },
        { code: "git push {--force}", desc: "Force push (simulated)" },
      ],
    ],
  },
  {
    label: "Config & Utility",
    rows: [
      [
        { code: 'git config {user.name} "name"', desc: "Set author name" },
        { code: "git config {--list}", desc: "Show all config values" },
      ],
      [
        { code: "clear", desc: "Clear terminal output" },
        { code: "reset", desc: "Wipe repo, start fresh" },
      ],
    ],
  },
];
