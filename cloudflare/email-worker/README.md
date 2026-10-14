# VoidOne Mail Gateway

Cloudflare Email Worker for `voidone.dpdns.org`. It routes inbound messages, applies sender and attachment policy, emits structured audit events, optionally notifies Slack, and stores metadata in Cloudflare KV for 90 days.

## What this does

- Routes `support`, `bugs`, `contact`, `info`, and `security` recipients.
- Uses a main verified Gmail inbox by default; per-route destinations can be configured as Worker variables.
- Blocks configured senders/domains and selected high-risk attachment extensions/MIME types.
- Records sender, recipient, timestamp, route, result, and reason; it does not intentionally store message bodies or attachment filenames.
- Attempts the main Gmail destination if a specialized route fails.

## Important security limitations

This is **not antivirus or a spam classifier**. It does not inspect the contents of files, unpack archives, or establish sender authenticity from the visible From header. MIME parse failures deliberately use a fail-open policy to avoid losing support messages; these messages are forwarded with a warning and logged as `forwarded_scan_error`. Change this to fail-closed if security is more important than continuity.

Cloudflare Email Routing must be enabled and the domain's MX records must point to Cloudflare's displayed Email Routing MX records. Do not mix them with another provider's MX records. The Worker processes inbound mail; it does not send outbound mail as `support@voidone.dpdns.org`.

## GitHub Actions deployment

The workflow in `.github/workflows/deploy-email-worker.yml` deploys after changes are merged to `main` (or via manual workflow dispatch). Add these GitHub Actions repository secrets:

- `CLOUDFLARE_API_TOKEN`: scoped to the correct account with Workers Scripts:Edit, Workers KV Storage:Edit, and permission to read account details.
- `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID.

The workflow creates/reuses a KV namespace named `voidone-mail-gateway-audit`, injects its ID into the deployment config, then deploys the Worker. It does not modify DNS or enable Email Routing automatically.

## First-time setup

1. Add the two GitHub Actions secrets above.
2. Update `GMAIL_INBOX` in `wrangler.jsonc` to the verified destination Gmail address. Do not put API tokens or webhook secrets in the repository.
3. Merge this feature into `main`; the GitHub Actions workflow deploys the Worker and creates its script if necessary.
4. In Cloudflare Email Routing, create rules for `support`, `bugs`, `contact`, `info`, and `security` that send to the Worker `voidone-mail-gateway`.
5. If using Slack alerts, add the Worker secret `SLACK_WEBHOOK_URL` in Cloudflare and keep `SLACK_NOTIFY_ALL=false` unless all-message notifications are desired.
6. Test with benign messages and inspect Worker Observability logs before routing all production mail.

## Optional variables

- `BLOCKED_SENDERS`: comma-separated exact email addresses.
- `BLOCKED_DOMAINS`: comma-separated sender domains.
- `SUPPORT_INBOX`, `BUGS_INBOX`, `CONTACT_INBOX`, `INFO_INBOX`, `SECURITY_INBOX`: optional verified per-route destinations.
- `MAX_MESSAGE_BYTES`: defaults to 15 MiB.
- `MAX_ATTACHMENTS`: defaults to 10.
- `MAX_TOTAL_ATTACHMENT_BYTES`: defaults to 10 MiB.
- `SLACK_NOTIFY_ALL`: `false` by default; failures and rejections are notified when a webhook is configured.

## Local checks

From this directory:

```bash
npm install
npm run check
npx wrangler deploy --dry-run
```

A dry-run may still require valid configuration; do not deploy to production until the destination address and Cloudflare credentials are set.
