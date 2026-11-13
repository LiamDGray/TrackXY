# What may be published

This repository is intended to become public. Some material that informed it may not travel with it.
This file records the rule, the reason, and the check.

## The rule

**Private material lives outside the repository.** Not gitignored inside it — outside it, at
`~/src/private/trackxy-replication/`. Ignoring a path in the repository still leaves the file one
`git add -f` away from being published, and one accidental commit away from history.

## What is out, and why

| Material | Why it cannot be published |
|---|---|
| The source paper (PDF) | Third-party copyrighted article. Redistribution is a licensing problem no matter how it is framed |
| The parts list (PDF) | Third-party document containing its author's name, email address, and purchase links. Not mine to republish |
| Raw captures and session figures | Session data from a private experiment; not mine to publish, and it carries whatever the session carries |
| Anything identifying a participant, or describing what is under the pendulum | Same |

Both documents are in `~/src/private/trackxy-replication/`, with a note there on what they are and
why they are not in the repository.

## Known history items

The repository was public and archived until 2026-11-12, and it became private before any of the
instrumentation work was pushed. Two things are still reachable in history and one in the tip:

| Item | Status |
|---|---|
| `secrets.enc.env` | **removed from the tree and from all history** on 2026-11-12; the file now lives at `~/src/secrets/secrets.enc.env` (0600) and is gitignored. Rotate the keys anyway: the blob was in a public repository until the repo was made private |
| Commit message naming the source paper's authors and journal | **rewritten**; history now says "a published torsion-balance protocol" |
| `sample.csv` (2012 capture) and `sample.csv in LibreOffice Calc.png` | **retained deliberately.** A 21-second configuration echo plus a tracking test: no personal data, no participant, no framing. It shows the tracker losing lock, which is a useful artefact rather than an embarrassing one |

The source paper and the parts list were **never pushed**. They existed in one unpushed commit, which
was amended and pruned; `git rev-list --objects --all` contains neither.

## What is in, and why

The instrumentation: calibration geometry, estimators, drift and spectrum analysis, receipts, and the
measurement reasoning. None of it depends on the hypothesis being tested. A tool that measures
sub-degree rotational drift in a slow torsion oscillator is a tool, and the docs state its limits.

## The judgement call that is mine to make

Naming the protocol invites a reader to look up what the protocol claims. Not naming it makes the
document less specific. The current docs name it once, in the reference list, and describe the
apparatus in engineering terms everywhere else. That is a deliberate middle position: specific enough
to be checkable, without leading with the claim.

## Before the first push

```bash
# 1. Nothing private is tracked.
git ls-files | grep -Ei 'hansen|parts list|participant|consent|session' || echo "clean"

# 2. Nothing private is anywhere in history (including deleted commits and reflogs).
git rev-list --objects --all | grep -Ei 'hansen|parts list' || echo "clean history"

# 3. No large binaries that should not be there.
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' \
  | awk '$1=="blob" && $2 > 500000 {print $2, $3}'

# 4. The docs build and the tests pass.
(cd js && npm test)
```

If step 2 ever finds something, the fix is a history rewrite *before* the first push, not a deletion
afterwards: a pushed commit is a published commit, mirrors and forks included.

## What stays, and why

Apparatus photographs and UI screenshots stay: a pointer, a dome, a tracking overlay. They show how the
instrument is built, not what a session measured. The line is not "anything from that project" — it is
"anything that carries a session".

## Once public

Do not add session captures, participant material, or third-party documents later. A commit that is
reverted is still in the history, and a public repository's history is part of the publication.
