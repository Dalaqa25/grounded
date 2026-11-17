# Rate Limits

## Relay API limits

| Plan | Requests / minute | Concurrent runs | Burst |
|---|---|---|---|
| Starter | 120 | 5 | 200 |
| Growth | 600 | 25 | 900 |
| Enterprise | 3,000 | 200 | negotiated |

Limits are per workspace, not per API key. Run-start requests count double
against the per-minute limit.

## Response headers
Every response carries the current state:

```
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 413
X-RateLimit-Reset: 1764582000
Retry-After: 12
```

`X-RateLimit-Reset` is a Unix timestamp. `Retry-After`, in seconds, appears
only on a 429.

## Handling 429
When you exceed a limit you get:

```json
{ "error": "RATE_LIMIT_EXCEEDED", "message": "Workspace limit of 600 req/min exceeded", "retry_after": 12 }
```

Honour `Retry-After` rather than backing off on your own schedule — it reflects
the real window, and a tighter loop will keep you throttled. Add jitter if you
have many clients, so they do not return in lockstep.

Inside a workflow you usually do not need to handle this yourself: 429 is in
the default `retry_on` set, so steps back off automatically. What you should
tune is `max_delay`, so a long throttle does not fail the run prematurely.

## Provider limits are separate
A step calling HubSpot is bound by HubSpot's limits too, and Relay does not
pool them for you. For high-volume fan-out, cap `concurrency` on `for_each`
below the provider's ceiling.

## Avoiding limits
- Batch where the provider has a batch endpoint.
- Use webhooks instead of polling. A workflow polling every minute burns the
  per-minute budget for no reason.
- Cache lookups that do not change within a run in a `transform` step.
