# Policy on AI Assistants and Generated Code

Short version: use them, review everything, and never paste customer data into
a tool we have not approved.

## Approved tools
- **Claude Code** and the Anthropic API — approved for all repositories,
  including customer code, under our zero-retention agreement.
- **GitHub Copilot** (business tier) — approved for internal repositories.
- **ChatGPT / OpenAI API** — approved for internal repositories and general
  work. **Not** approved for customer code or customer data.
- Anything else needs a request to Security, who answer within a week.

## Customer code and data
Customer code may only go into tools covered by a zero-retention agreement,
which today means Claude Code and the Anthropic API. Customer personal data,
credentials, API keys and production database contents must never be pasted
into any assistant, approved or not.

If you need to debug with real data, use the scrubbed staging dataset.

## Review standard
Generated code is held to exactly the same standard as hand-written code. The
author is responsible for it. "The model wrote it" is not a review comment and
is not a defence in an incident review.

In practice:
- Read every line before you commit it. If you do not understand it, do not
  ship it.
- Generated tests count only if you have checked that they fail against the
  broken version.
- Never let an agent commit, push or open a pull request unattended on a
  production repository.

## Attribution
Pull requests written largely with an assistant should say so in the
description. One line is enough. This is for context during review, not
judgement.

## Agents with credentials
Any agent given live credentials to a customer system needs a scope review
from Security first. Least privilege is required, not encouraged: the scopes
granted must be the narrowest set that completes the task.
