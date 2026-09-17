@AGENTS.md

## Working rule (owner, PR #26 acceptance work)

Within an agreed task's stated scope: if you find a defect, fix it yourself,
verify the fix, then report — don't stop at "I found X, I can fix it" and
wait for a second go-ahead. If closing the task needs an action outside the
task's permission boundary (an account you don't have, a session you can't
open, a secret you shouldn't see), name that exact blocker and finish every
other independently-allowed part of the task anyway.

This does not relax the standing limits: never merge, never touch `main` or
Production, never change secrets or account/repo permissions or GitHub App
visibility without an explicit separate go-ahead.
