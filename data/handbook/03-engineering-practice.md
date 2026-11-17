# Engineering Practice

## Code review
Every change to a production repository goes through a pull request with at
least **one approving review**. Changes touching authentication, billing or
customer data need **two**, one of which must be from the owning team.

Reviews are expected within one working day. If a review is blocking and has
been waiting longer, escalate in the team channel rather than waiting quietly.

## Deploys
We deploy continuously. Merging to `main` ships to staging automatically;
production is a manual promote that any engineer can trigger.

### Friday and pre-holiday deploys
Production deploys after **14:00 UTC on Friday**, or on the last working day
before a public holiday, need sign-off from the **on-call engineer** and the
**engineering manager who owns the service**. This is not a ban. It exists so
that someone who will be awake is aware the change went out.

Hotfixes for active incidents are exempt and need no sign-off.

## Incidents
Severity is set by customer impact, not by cause.

- **Sev-1** — customers cannot use a core flow. Page immediately, open a call,
  post an update every 30 minutes.
- **Sev-2** — degraded or partial. Respond within an hour during working hours.
- **Sev-3** — annoying, not blocking. Handle in the next sprint.

Every Sev-1 and Sev-2 gets a written review within five working days. These are
blameless: the output is a system change, not a person's name.

## On-call
One primary and one secondary per week, rotating. On-call is compensated at
**EUR 350 a week**, plus EUR 90 for each night interrupted. You are not
expected to do project work while primary.

## Testing
No target coverage percentage. The expectation is that every bug fix adds the
test that would have caught it, and that anything touching money or
permissions has an end-to-end test.
