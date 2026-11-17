# Authentication, Connections and Scopes

## API authentication
Relay's own API uses bearer tokens.

```http
Authorization: Bearer rl_live_8f2b...
```

Keys are environment-scoped: `rl_dev_`, `rl_stg_`, `rl_live_`. A key carries a
role — `reader`, `operator` or `admin`. Operators can start, resume and cancel
runs; only admins can publish workflows or manage connections.

Rotate in **Settings → API keys**. The old key keeps working for **24 hours**
after rotation to allow a clean cutover.

## Connections to third-party systems
Connections hold OAuth tokens or API keys for providers. They are created
through the connection flow in the UI or with a hosted link:

```http
POST /v1/connections/link
{ "provider": "hubspot", "environment": "production", "scopes": ["crm.objects.contacts.read"] }
```

The response carries a one-time URL valid for 30 minutes.

## Scopes
Relay requests the **narrowest scope set** a workflow needs, computed from the
steps in the published version. Adding a step that needs a wider scope marks
the connection as `needs_reauth`; the workflow still runs until the next
publish, then fails closed.

Token refresh is automatic. If a refresh token is revoked at the provider, the
connection moves to `revoked` and runs that use it fail with `AUTH_401_REVOKED`.

## Error: AUTH_403_SCOPE

```json
{
  "error": "AUTH_403_SCOPE",
  "message": "Connection conn_8812 is missing scope crm.objects.deals.write",
  "connection_id": "conn_8812",
  "missing_scopes": ["crm.objects.deals.write"]
}
```

The connection authenticated successfully but does not carry a scope the step
needs. This almost always means a step was added or changed after the
connection was first authorised.

Fix it:

1. Open **Connections**, find the connection in `missing_scopes`.
2. Click **Re-authorise**. The flow requests the current scope set, not the
   original one.
3. Resume the failed run from the failed step.

If re-authorising does not clear it, the provider account itself lacks the
permission — an admin at the customer's end has to grant it before the OAuth
flow can offer it. Check with `GET /v1/connections/{id}/scopes`, which returns
`granted` and `required` side by side.

Do not work around this by widening the scope request for every connection.
Relay fails closed on purpose.
