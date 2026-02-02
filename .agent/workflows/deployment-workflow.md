---
description: How to correctly deploy HomeTeacher (frontend & submodule updates)
---

# HomeTeacher Deployment Workflow

The HomeTeacher project uses a submodule structure. To deploy changes, you must update both the child repository (`home-teacher-core`) and the parent repository (`HomeTeacher`).

## 1. Deploy `home-teacher-core`
First, commit and push changes in the core repository.

```bash
cd repos/home-teacher-core
git add .
git commit -m "fix: your message here"
git push origin main
```

## 2. Update Parent Repository (`HomeTeacher`)
**CRITICAL**: The parent repository tracks the specific commit hash of the submodule. You MUST update this reference for the changes to go live.

We verify version alignment using `make update-versions`.

```bash
cd ../.. # Go to c:\VibeCode\HomeTeacher
make update-versions
git add .
git commit -m "chore: update submodule versions"
git push origin main
```

## Troubleshooting
- If `git push origin main` says "Everything up-to-date" but changes aren't live, check if you forgot step 2.
- Verify `VERSIONS` file in the parent root to see if the commit hash matches the latest `home-teacher-core` commit.

## ⚠️ Important Verification Step
After running the push command in Step 2, **ALWAYS run `git status`** to confirm that the working tree is clean.
Sometimes, `git add .` might capture files (like this workflow documentation) that `git commit` misses if run in a quick sequence without proper checks.
**If `git status` shows staged changes, commit and push them explicitly.**
