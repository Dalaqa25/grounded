# Triggers and Webhooks

## Trigger types

| Type | Fires when |
|---|---|
| `webhook` | An HTTP request hits the workflow's endpoint |
| `schedule` | A cron expression matches |
| `event` | Another Relay workflow emits a matching event |
| `manual` | Someone clicks Run, or the API is called |

## Webhook triggers
Publishing a workflow with a webhook trigger gives it a URL:

```
https://in.relay.dev/w/{workflow_id}/{token}
```

The token is part of the URL and is not a secret in the cryptographic sense.
For anything sensitive, add signature verification.

```yaml
trigger:
  type: webhook
  with:
    method: POST
    signature:
      algorithm: hmac-sha256
      header: X-Signature
      secret: "{{ secrets.WEBHOOK_SECRET }}"
```

Requests failing verification are rejected with 401 and are not recorded as
runs.

### Response behaviour
By default Relay answers `202 Accepted` immediately and runs the workflow
asynchronously. That keeps the sender fast and is almost always what you want.

For a synchronous response, set `respond: on_completion` and add a
`respond` step. The caller waits up to **30 seconds**; past that it gets a 504
and the run continues in the background.

## Schedule triggers
```yaml
trigger:
  type: schedule
  with:
    cron: "0 7 * * 1-5"
    timezone: Europe/Berlin
```

Timezone is required; there is no implicit UTC. Daylight saving is honoured, so
a 07:00 job stays at 07:00 local. A schedule that would fire twice on a
clock-back night fires once.

Overlapping runs are skipped by default: if the previous run is still going,
the new one is dropped and recorded as `skipped`. Set `allow_overlap: true` to
change that.

## Event triggers
Workflows can emit events for others to consume, which keeps long chains out of
one definition:

```yaml
  - id: announce
    type: emit_event
    with:
      name: invoice.pushed
      payload: { invoice_id: "{{ push_invoice.body.id }}" }
```
