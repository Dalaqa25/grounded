# Retries, Resuming and Recovery

## Automatic retries
Every step has a retry policy. The default is **3 attempts** with exponential
backoff starting at 1 second, jittered, and only for retryable failures:
connection errors, timeouts, HTTP 429, and HTTP 5xx.

HTTP 4xx other than 429 is treated as permanent and is not retried, because
retrying a malformed request just fails more slowly.

```yaml
  - id: push_invoice
    type: http.request
    retry:
      max_attempts: 5
      backoff: exponential
      initial_delay: 2s
      max_delay: 60s
      retry_on: [429, 500, 502, 503, 504, timeout]
    with:
      method: POST
      url: https://api.billing.example.com/invoices
```

Set `max_attempts: 1` to disable retries.

## Resuming a failed run
A failed run can be resumed from the failed step. Earlier steps are **not**
re-executed; their recorded outputs are reused from the run context. This is
the right tool when the failure was environmental — an expired credential, a
provider outage, a rate limit you have since raised.

In the UI: open the run, then **Resume from failed step**.

Via the API:

```http
POST /v1/runs/{run_id}/resume
Content-Type: application/json

{ "from_step": "push_invoice" }
```

`from_step` is optional. Omitted, it resumes from the first failed step. If you
name a step that already succeeded, that step and everything after it re-runs.

Constraints:

- Resume works for **14 days** after the run failed, as long as the run record
  is still within retention.
- A run may be resumed at most **10 times**.
- You cannot resume a run whose workflow version has been deleted. Publishing
  a new version is fine; the resume uses the original version.
- A `cancelled` run cannot be resumed; start a new run instead.

## Replaying a whole run
**Replay** re-executes from the beginning with the original trigger payload.
It creates a new run linked to the original by `replay_of`. Use this when the
input was fine but the workflow logic was wrong and you have since fixed it.

```http
POST /v1/runs/{run_id}/replay
```

## Idempotency
Resume and replay both re-send requests the provider may have already seen. For
any step that creates something, set an idempotency key so a duplicate attempt
is a no-op on the provider's side:

```yaml
    with:
      headers:
        Idempotency-Key: "{{ run.id }}-push_invoice"
```

Use `run.id`, not `now()`. A key that changes per attempt defeats the purpose.

## Dead-letter queue
Runs that exhaust retries land in the workspace dead-letter queue, where they
stay for 14 days and can be resumed in bulk. Enable alerting on DLQ depth in
**Settings → Alerts**; the default threshold is 25.
