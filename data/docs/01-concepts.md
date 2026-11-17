# Relay — Core Concepts

Relay runs **workflows**: ordered sequences of **steps** that move data between
systems. A workflow is triggered, runs to completion or failure, and leaves a
**run** record behind.

## Workflow
A YAML or JSON definition with a trigger and a list of steps. Workflows are
versioned; publishing creates an immutable version and new runs use the latest
published version. Runs already in flight finish on the version they started
with.

## Step
A single unit of work: an HTTP request, a connector action, a transform, or a
branch. Every step has an `id` that must be unique within the workflow, and
that `id` is how other steps reference its output.

## Run
One execution. A run holds the input payload, the output of every step, timing,
and the final status: `queued`, `running`, `succeeded`, `failed`, `cancelled`
or `partially_succeeded`.

Runs are retained for **30 days** on Starter, **90 days** on Growth and
**400 days** on Enterprise.

## Connection
Stored credentials for a third-party system, owned by a workspace. A step
references a connection by `connection_id`; credentials are never written into
the workflow definition.

## Environment
Each workspace has `development`, `staging` and `production`. Connections and
variables are scoped per environment, so promoting a workflow does not carry
credentials across.
