# Service logs (Loki)

Each service in the catalogue has a **Logs** tab. It reads from one Grafana Loki that
DaleelEx is connected to. This page explains how that connection works and what a
service has to do for its logs to show up.

## How it works

DaleelEx is connected to Loki **once**, not once per service. When someone opens a
service's Logs tab, the API asks that Loki for the lines whose stream label matches the
service's catalogue ID:

| Service         | Catalogue ID      | Query DaleelEx sends             |
| --------------- | ----------------- | -------------------------------- |
| API Gateway     | `svc-gw-002`      | `{service_id="svc-gw-002"}`      |
| Billing Service | `svc-billing-007` | `{service_id="svc-billing-007"}` |

So there are two halves:

1. **An administrator connects Loki** in the portal (once).
2. **Each service ships its logs to Loki with a `service_id` label** equal to its
   catalogue ID (once per service, in the service's log shipper).

A service that has not done step 2 has an empty Logs tab. Nothing else breaks.

DaleelEx only reads from Loki. It never stores, forwards, or writes log lines.

## 1. Connect Loki (administrators)

Go to **Settings → Integrations → Loki** and fill in:

- **Loki URL** — the root URL of your Loki, for example `http://loki.internal:3100`. It
  must be reachable from the DaleelEx **API server**, not from your browser.
- **Service label** — the stream label that carries the catalogue service ID. The
  default is `service_id`.

**Test connection** checks that the URL answers like Loki and tells you whether any
recent stream carries the service label. **Save** applies immediately; the API does not
need a restart. **Disconnect** removes the saved configuration.

The badge on the card shows where the active configuration comes from:

| Badge          | Meaning                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| Connected      | Saved in the portal. This always wins.                                    |
| Via env vars   | Nothing saved; using `LOKI_URL` / `LOKI_SERVICE_LABEL` from the API env.  |
| Not configured | Neither is set. The Logs tab shows generated sample lines, not real logs. |

## 2. Label each service's logs

This is configured in whatever ships the service's logs to Loki, not in DaleelEx. The
label value must match the `metadata.id` in the service's `catalog-info.yaml` exactly.

**Grafana Alloy**

```alloy
local.file_match "gateway" {
  path_targets = [{
    __path__   = "/var/log/api-gateway/*.log",
    service_id = "svc-gw-002",
  }]
}

loki.source.file "gateway" {
  targets    = local.file_match.gateway.targets
  forward_to = [loki.write.default.receiver]
}

loki.write "default" {
  endpoint {
    url = "http://loki.internal:3100/loki/api/v1/push"
  }
}
```

**Docker (Loki logging driver)**

```yaml
services:
  api-gateway:
    logging:
      driver: loki
      options:
        loki-url: 'http://loki.internal:3100/loki/api/v1/push'
        loki-external-labels: 'service_id=svc-gw-002'
```

Any other shipper works the same way: add a static label named `service_id` whose value
is the catalogue ID.

### Already shipping logs under a different label?

If your streams already carry the catalogue ID under another name (say `app`), set
**Service label** on the Loki card to that name instead of relabelling every service.
This only works when the label's _values_ are the catalogue IDs. If they are different
names (`api-gateway` rather than `svc-gw-002`), the streams need a `service_id` label
added; a per-service override is not supported yet.

### Log levels

The level badge on each line comes from the stream's `level` label, or Loki's
`detected_level` when there is none. Lines with neither are shown as `info`.

## Try it locally

The development Compose file includes a Loki. With Docker running:

```bash
docker compose up -d loki
```

Push a test line for a service in your catalogue (replace the ID):

```bash
curl -X POST http://localhost:3100/loki/api/v1/push \
  -H 'Content-Type: application/json' \
  -d "{\"streams\":[{\"stream\":{\"service_id\":\"svc-gw-002\",\"level\":\"info\"},\"values\":[[\"$(date +%s)000000000\",\"hello from Loki\"]]}]}"
```

Then connect `http://localhost:3100` on the Loki card (use `http://loki:3100` instead if
the API itself runs in Compose) and open that service's Logs tab. The dev Loki keeps its
data inside the container, so lines are gone after `docker compose down`.

## Who can see logs

Logs can contain secrets and customer data, so the Logs tab is restricted to
administrators. The Loki settings are administrator-only as well.

## Troubleshooting

| Symptom                                                      | Likely cause                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Test says Loki could not be reached                          | The URL is not reachable from the API server. Inside Compose, `localhost` is the API container itself.     |
| Test passes with a warning about the label                   | Loki is fine, but no recent stream has the service label. Check the shipper config from step 2.            |
| One service's Logs tab is empty, others work                 | That service's label value does not match its catalogue ID, or it has no lines in the selected time range. |
| Test says Loki requires authentication                       | Loki is behind basic auth or a tenant header. The connector does not support authentication yet.           |
| Every service shows plausible logs, even ones that ship none | No Loki is connected and you are seeing sample lines. The Loki card says "Not configured" in this case.    |
