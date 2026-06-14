# Git & GitHub — Beginner Cheat Sheet 🌱

A quick desk reference. Keep it open until the daily loop is muscle memory.
*(macOS · zsh · VS Code)*

---

## 🧠 The one idea

Your code lives in **two places**:

- **Local** = the folder on your laptop (what VS Code edits).
- **Remote** = GitHub, in the cloud (shared with your team).

They are separate. Your laptop changes don't reach GitHub until you **push**.
GitHub changes don't reach your laptop until you **pull**. Most confusion comes
from forgetting that — so the #1 habit is **pull before you start**.

A **commit** = a save point with a note describing what changed.

---

## 🔁 The daily loop (you'll do this 90% of the time)

```bash
git pull                         # 1. get the latest from GitHub BEFORE editing
# ...edit your files...
git status                       # 2. see what changed (do this often)
git add .                        # 3. stage your changes (. = everything)
git commit -m "What you changed" # 4. make the save point (local only)
git push                         # 5. send it up to GitHub
```

**Pull → edit → add → commit → push.** That's the heartbeat.

---

## 📖 Command reference

| Command | Plain English |
|---|---|
| `git clone <url>` | Download a repo to your laptop the first time |
| `git status` | "What did I change / where do I stand?" — most-used command |
| `git pull` | Bring GitHub's latest changes down to your laptop |
| `git add .` | Stage everything for the next commit (or `git add file.html` for one) |
| `git commit -m "msg"` | Snapshot staged changes locally, with a note |
| `git push` | Upload your commits to GitHub |
| `git log --oneline` | See the history of commits |
| `git diff` | See exactly what you changed (not yet staged) |
| `git branch` | List branches (★ = the one you're on) |

> `add` then `commit` is two steps on purpose: `add` = "include this",
> `commit` = "snapshot it now."

---

## 🌿 Branches & Pull Requests (how teams work)

You usually **don't edit `main` directly** at a job. Instead:

```bash
git checkout -b my-feature       # create + switch to a new branch
# ...work, then...
git add . && git commit -m "Add my feature"
git push -u origin my-feature    # push the branch to GitHub
```

Then on **github.com**, open a **Pull Request (PR)** → teammates review and
comment → it gets **merged** into `main`. A PR is just "please review my changes
before they join the shared code."

Switch branches: `git checkout main` · `git checkout my-feature`

---

## 🆘 "Oh no" recipes

| Situation | Fix |
|---|---|
| Lost / confused | `git status` — it almost always tells you what to do |
| Undo last commit, keep my edits | `git reset --soft HEAD~1` |
| Throw away ALL my uncommitted edits | `git checkout -- .` *(careful — can't undo)* |
| Make my folder exactly match GitHub | `git fetch origin && git reset --hard origin/main` *(discards local edits)* |
| Merge conflict | VS Code shows **Accept Current / Incoming / Both** — pick, save, commit |
| Bookmark for everything else | [ohshitgit.com](https://ohshitgit.com) |

Committed work is very hard to truly lose — that's git's whole point.

---

## ✅ Golden habits

1. **`git pull` before you start.** Avoids working on a stale copy.
2. **Commit small & often** with clear messages (`Fix login redirect`, not `stuff`).
3. **GitHub `main` is the source of truth** — not a folder on your Desktop.
4. **Branch for anything non-trivial**, and let PRs get reviewed.
5. **Never `git push -f` (force) a shared branch** — it can erase teammates' work.

---

## 🖱️ VS Code equivalents (Source Control panel — branch icon, or ⌃⇧G)

- **Stage** a file → click the **+** next to it (= `git add`)
- **Commit** → type a message, click **✓ Commit**
- **Push/Pull** → **Sync Changes** button / the **↻** (= `git push` + `git pull`)
- **See changes** → click a file to view the side-by-side diff
- **Switch/create branch** → click the branch name in the bottom-left status bar

---

## 📚 Keep learning (free)

- **skills.github.com** — interactive, hands-on, by GitHub. Start here.
- **ohshitgit.com** — "I broke it, how do I fix it" recipes.
- Just *using* the VS Code Source Control panel daily teaches a lot.

> First-day drill: in a cloned repo, change one line in the README, then run
> `git status` → `git add .` → `git commit -m "test"` → `git push`, and watch it
> appear on GitHub. Do it three times and the fear is gone.
