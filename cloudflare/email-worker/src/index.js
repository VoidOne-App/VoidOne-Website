import PostalMime from "postal-mime";

const DEFAULT_DOMAIN = "voidone.dpdns.org";
const AUDIT_TTL_SECONDS = 90 * 24 * 60 * 60;

const ROUTES = {
  support: "SUPPORT_INBOX",
  bugs: "BUGS_INBOX",
  contact: "CONTACT_INBOX",
  info: "INFO_INBOX",
  security: "SECURITY_INBOX"
};

const BLOCKED_EXTENSIONS = new Set([
  "exe", "dll", "com", "scr", "msi", "msp", "bat", "cmd",
  "ps1", "vbs", "vbe", "hta", "lnk", "iso", "dmg", "apk",
  "jar", "sh", "reg", "docm", "xlsm", "pptm"
]);

const BLOCKED_MIME_TYPES = new Set([
  "application/x-msdownload",
  "application/x-dosexec",
  "application/x-executable",
  "application/x-sh",
  "application/vnd.microsoft.portable-executable"
]);

function csvSet(value = "") {
  return new Set(value.split(",").map(v => v.trim().toLowerCase()).filter(Boolean));
}

function parseAddress(address = "") {
  const value = address.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return null;
  return { local: value.slice(0, at), domain: value.slice(at + 1) };
}

function getPositiveInt(env, key, fallback) {
  const n = Number(env[key]);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

function resolveRoute(local, env) {
  const binding = ROUTES[local];
  if (!binding) return null;
  return env[binding] || env.GMAIL_INBOX || null;
}

function isBlocked(sender, env) {
  const parsed = parseAddress(sender);
  if (!parsed) return true;
  return csvSet(env.BLOCKED_SENDERS).has(sender.trim().toLowerCase()) ||
    csvSet(env.BLOCKED_DOMAINS).has(parsed.domain);
}

function safeError(error) {
  // Do not include message bodies, attachment names, or credentials in logs.
  return error instanceof Error ? error.name : "UnknownError";
}

function record(ctx, env, event) {
  const entry = {
    timestamp: new Date().toISOString(),
    from: event.from || "",
    to: event.to || "",
    route: event.route || "",
    result: event.result,
    reason: event.reason || ""
  };

  console.log(JSON.stringify(entry));

  ctx.waitUntil((async () => {
    try {
      if (env.AUDIT_LOGS) {
        await env.AUDIT_LOGS.put(
          `${Date.now()}-${crypto.randomUUID()}`,
          JSON.stringify(entry),
          { expirationTtl: AUDIT_TTL_SECONDS }
        );
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "audit_storage_failed",
        error: safeError(error)
      }));
    }

    if (
      env.SLACK_WEBHOOK_URL &&
      (env.SLACK_NOTIFY_ALL === "true" || entry.result !== "forwarded")
    ) {
      try {
        const response = await fetch(env.SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: [
              "VoidOne Mail Gateway",
              `Result: ${entry.result}`,
              `From: ${entry.from || "(empty)"}`,
              `To: ${entry.to || "(unknown)"}`,
              `Route: ${entry.route || "(none)"}`,
              `Reason: ${entry.reason || "(none)"}`,
              `Time: ${entry.timestamp}`
            ].join("\n")
          })
        });
        if (!response.ok) {
          console.error(JSON.stringify({
            event: "slack_notification_failed",
            status: response.status
          }));
        }
      } catch (error) {
        console.error(JSON.stringify({
          event: "slack_notification_failed",
          error: safeError(error)
        }));
      }
    }
  })());
}

function reject(message, ctx, env, event, reason) {
  message.setReject(reason);
  record(ctx, env, { ...event, result: "rejected", reason });
}

function checkAttachments(attachments, env) {
  const maxCount = getPositiveInt(env, "MAX_ATTACHMENTS", 10);
  const maxBytes = getPositiveInt(env, "MAX_TOTAL_ATTACHMENT_BYTES", 10 * 1024 * 1024);

  if (attachments.length > maxCount) return "attachment_count_limit";

  let total = 0;
  for (const attachment of attachments) {
    const filename = String(attachment.filename || "").toLowerCase();
    const mime = String(attachment.mimeType || attachment.contentType || "")
      .split(";")[0].trim().toLowerCase();
    const extension = filename.includes(".") ? filename.split(".").pop() : "";
    const content = attachment.content;
    total += Number(content?.byteLength ?? content?.length ?? 0);

    if (BLOCKED_EXTENSIONS.has(extension)) return "blocked_attachment_extension";
    if (BLOCKED_MIME_TYPES.has(mime)) return "blocked_attachment_mime";
  }

  if (total > maxBytes) return "attachment_size_limit";
  return null;
}

function forwardingHeaders(route, scanStatus) {
  return new Headers({
    "X-VoidOne-Processed-By": "VoidOne-Mail-Gateway",
    "X-VoidOne-Route": route,
    "X-VoidOne-Scan": scanStatus,
    "X-VoidOne-Processed-At": new Date().toISOString()
  });
}

export default {
  async email(message, env, ctx) {
    const from = message.from || "";
    const to = message.to || "";
    const event = { from, to };
    const domain = (env.MAIL_DOMAIN || DEFAULT_DOMAIN).toLowerCase();
    const recipient = parseAddress(to);

    if (!recipient || recipient.domain !== domain) {
      return reject(message, ctx, env, event, "unknown_recipient");
    }

    const route = resolveRoute(recipient.local, env);
    if (!route) {
      return reject(message, ctx, env, { ...event, route: recipient.local }, "route_not_configured");
    }

    if (!message.canBeForwarded) {
      return reject(message, ctx, env, { ...event, route: recipient.local }, "message_cannot_be_forwarded");
    }

    const maxMessageBytes = getPositiveInt(env, "MAX_MESSAGE_BYTES", 15 * 1024 * 1024);
    if (Number(message.rawSize) > maxMessageBytes) {
      return reject(message, ctx, env, { ...event, route: recipient.local }, "message_size_limit");
    }

    if (isBlocked(from, env)) {
      return reject(message, ctx, env, { ...event, route: recipient.local }, "blocked_sender");
    }

    let scanStatus = "mime-checked";
    try {
      const parsed = await PostalMime.parse(message.raw);
      const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
      const problem = checkAttachments(attachments, env);
      if (problem) {
        return reject(message, ctx, env, { ...event, route: recipient.local }, problem);
      }
    } catch (error) {
      // Deliberate fail-open policy for support continuity; alert and log it.
      scanStatus = "scan-error-forwarded";
      console.error(JSON.stringify({
        event: "mime_scan_failed",
        from,
        to,
        error: safeError(error)
      }));
    }

    try {
      await message.forward(route, forwardingHeaders(recipient.local, scanStatus));
      record(ctx, env, {
        ...event,
        route: recipient.local,
        result: scanStatus === "mime-checked" ? "forwarded" : "forwarded_scan_error",
        reason: scanStatus === "mime-checked" ? "" : "mime_parser_failed"
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: "forward_failed",
        from,
        to,
        route: recipient.local,
        error: safeError(error)
      }));

      if (env.GMAIL_INBOX && route !== env.GMAIL_INBOX) {
        try {
          await message.forward(env.GMAIL_INBOX, forwardingHeaders(recipient.local, "fallback"));
          record(ctx, env, {
            ...event,
            route: recipient.local,
            result: "forwarded_fallback",
            reason: "primary_destination_failed"
          });
          return;
        } catch (fallbackError) {
          console.error(JSON.stringify({
            event: "fallback_forward_failed",
            from,
            to,
            error: safeError(fallbackError)
          }));
        }
      }

      reject(message, ctx, env, { ...event, route: recipient.local }, "forward_failed");
    }
  }
};
