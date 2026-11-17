# Passing Data Between Steps

Every step writes its result into the run context under its own `id`. Later
steps read from it with a `{{ }}` expression.

## Basic reference

```yaml
steps:
  - id: fetch_customer
    type: http.request
    with:
      method: GET
      url: https://api.example.com/customers/{{ trigger.body.customer_id }}

  - id: create_ticket
    type: zendesk.create_ticket
    with:
      connection_id: conn_8812
      subject: "Renewal for {{ fetch_customer.body.name }}"
      requester_email: "{{ fetch_customer.body.email }}"
```

`fetch_customer.body` is the parsed response body. The raw text is at
`fetch_customer.text`, headers at `fetch_customer.headers`, and the status code
at `fetch_customer.status`.

## Available roots

| Root | Contains |
|---|---|
| `trigger` | The event that started the run: `trigger.body`, `trigger.headers`, `trigger.query` |
| `<step_id>` | The output of any earlier step |
| `vars` | Workspace variables for the current environment |
| `secrets` | Secret variables. Redacted in logs and in the run viewer |
| `run` | `run.id`, `run.started_at`, `run.environment`, `run.attempt` |

## Expressions
Expressions are a restricted subset — property access, array indexing, and a
small function library. There is no arbitrary code evaluation inside `{{ }}`.

```yaml
# indexing and defaults
"{{ fetch_customer.body.contacts[0].email | default('none') }}"

# helpers
"{{ now('iso') }}"
"{{ upper(fetch_customer.body.country) }}"
"{{ json(fetch_customer.body) }}"
"{{ len(list_orders.body.items) }}"
```

For anything more complex use a `transform` step, which runs sandboxed
JavaScript with a 2-second limit:

```yaml
  - id: shape
    type: transform
    with:
      code: |
        return input.items
          .filter(i => i.status === 'open')
          .map(i => ({ id: i.id, total: i.amount_cents / 100 }));
      input: "{{ list_orders.body }}"
```

## Looping
`for_each` runs a sub-step per item, with `item` and `index` in scope.
Concurrency defaults to 5 and caps at 20.

```yaml
  - id: notify
    type: for_each
    with:
      items: "{{ shape.output }}"
      concurrency: 10
      step:
        type: slack.post_message
        with:
          connection_id: conn_3310
          channel: "#orders"
          text: "Order {{ item.id }} is {{ item.total }} EUR"
```
