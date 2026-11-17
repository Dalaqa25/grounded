# Error Reference

Every error carries a stable `error` code, a human `message`, and often a
field pointing at what to fix. Match on the code, never on the message text.

## Authentication and authorisation

| Code | Meaning | What to do |
|---|---|---|
| `AUTH_401_INVALID_KEY` | API key is wrong, revoked or for another environment | Check the key prefix matches the environment |
| `AUTH_401_REVOKED` | The provider revoked the connection's refresh token | Re-authorise the connection |
| `AUTH_403_SCOPE` | Connection lacks a scope the step needs | Re-authorise; see Authentication and Scopes |
| `AUTH_403_ROLE` | API key's role cannot do this | Operator keys cannot publish; use an admin key |

## Workflow and run

| Code | Meaning | What to do |
|---|---|---|
| `WORKFLOW_404` | No workflow with that id in this environment | Workflows are environment-scoped; check you are not calling production with a dev id |
| `WORKFLOW_409_UNPUBLISHED` | Draft has never been published | Publish before triggering |
| `RUN_409_NOT_RESUMABLE` | Run is cancelled, too old, or out of resume attempts | Replay instead |
| `RUN_422_EXPRESSION` | A `{{ }}` expression referenced something missing | The `path` field names the broken expression |
| `STEP_408_TIMEOUT` | Step exceeded its timeout, 60s default | Raise `timeout`, or move the work to a queue |
| `TRANSFORM_400_SANDBOX` | Transform threw, or exceeded its 2s limit | Check `details.stack` |

## Limits and platform

| Code | Meaning | What to do |
|---|---|---|
| `RATE_LIMIT_EXCEEDED` | Workspace limit exceeded | Honour `retry_after` |
| `CONCURRENCY_LIMIT` | Too many runs in flight | Runs queue rather than fail, unless the queue exceeds 10,000 |
| `PAYLOAD_413` | Trigger payload above 1 MB | Send a reference and fetch inside the workflow |
| `PROVIDER_502` | Upstream provider returned an error | Retryable; inspect `details.provider_response` |

## Reading an error in a run
Open the run, select the failed step, and use the **Raw** tab. It shows the
request Relay sent, with secrets redacted, and the full provider response. That
is usually faster than reasoning from the error code alone.
