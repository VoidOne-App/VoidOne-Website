# VoidOne Email Gateway

Cloudflare Email Worker for routing inbound mail for `voidone.dpdns.org`.

## Features

- Routes `support`, `bugs`, `contact`, `info`, and `security`.
- Optional exact-sender and sender-domain blocklists.
- Message-size, attachment-count, attachment-size, extension, and MIME-type policy checks.
- Structured logs with timestamp, sender, recipient, route, result, and reason. Message bodies, subjects, and attachment contents are not logged.
- Optional Slack notifications for rejected/error events.
- Optional KV audit binding; if configured, events expire after 90 days.
- Optional strict MIME mode: set `STRICT_MIME_SCAN=true` to reject messages when MIME parsing fails.

**This is not antivirus or a full spam classifier.** It does not unpack archives or scan file contents. MIME types and extensions can be spoofed. Do not treat a successful check as proof that an attachment is safe.

## GitHub Actions deployment

The workflow at `.github/workflows/deploy-email-worker.yml` deploys this directory to Cloudflare after changes reach `main`, or when manually dispatched.

Add these repository Actions secrets:

- `CLOUDFLARE_API_TOKEN`: scoped to the intended Cloudflare account with permission to edit/deploy Workers.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.

The workflow can create the Worker via Wrangler, but it cannot configure your private account without those credentials. Never commit tokens or webhook URLs.

## Required Worker settings

After the first successful deployment, open Cloudflare Dashboard → Workers & Pages → `voidone-email-gateway` → Settings → Variables and Secrets. Add:

- `GMAIL_INBOX`: your verified forwarding destination.
- Optional `SUPPORT_INBOX`, `BUGS_INBOX`, `CONTACT_INBOX`, `INFO_INBOX`, `SECURITY_INBOX`: separate verified destinations. If omitted, the main inbox is used.
- Optional `BLOCKED_SENDERS`: comma-separated exact email addresses.
- Optional `BLOCKED_DOMAINS`: comma-separated domains.
- Optional `MAX_MESSAGE_BYTES`: default 15728640 (15 MiB).
- Optional `MAX_ATTACHMENTS`: default 10.
- Optional `MAX_TOTAL_ATTACHMENT_BYTES`: default 10485760 (10 MiB).
- Optional `STRICT_MIME_SCAN`: set to `true` to reject mail if MIME parsing fails.
- Optional secret `SLACK_WEBHOOK_URL`.
- Optional `SLACK_NOTIFY_ALL`: set to `true` to notify on successful forwards too.

Variables are kept across Wrangler deployments. Secrets should be added using Cloudflare's secret manager.

## Optional persistent audit log (KV)

Without KV, structured logs are available through Workers Observability and are subject to Cloudflare's log availability/retention settings.

For a separate 90-day audit store:

1. Create a Workers KV namespace named `VOIDONE_MAIL_AUDIT`.
2. Add a KV binding named `AUDIT_LOGS` to this Worker, targeting that namespace.
3. Confirm the binding remains configured when updating deployment settings.

The Worker writes only metadata to KV and sets a 90-day TTL. Restrict access to audit records because sender and recipient addresses are personal data.

## Email Routing setup

1. Deploy the Worker and configure `GMAIL_INBOX` first.
2. In Cloudflare Email Routing, create a rule for each supported address and select **Send to a Worker** → `voidone-email-gateway`.
3. Verify the destination address.
4. Ensure Cloudflare Email Routing's MX records are active. Do not leave conflicting InstantNode and Cloudflare Email Routing MX configurations in place.
5. Test one address at a time before adding the other four.

Do not change website DNS records as part of this Worker setup. Email Workers handle inbound processing and forwarding; they do not provide outbound SMTP or make Gmail accept outgoing mail from the custom domain.

## Local tests

From this directory:

```sh
npm install
npm test
```

Tests cover routing and policy helpers, not Cloudflare's live email infrastructure. Complete a real end-to-end test only after configuring the Worker and Email Routing.
