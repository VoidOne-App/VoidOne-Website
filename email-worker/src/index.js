import PostalMime from "postal-mime";

const DOMAIN = "voidone.dpdns.org";
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

function safeText(value, max = 320) {
  return String(value ?? "")
    .replace(/[\r\n\t\0]/g, " ")
    .slice(0, max);
}

export function csvSet(value = "") {
  return new Set(
    String(value)
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function getLocalPart(address = "") {
  const normalized = String(address).trim().toLowerCase();
  const at = normalized.lastIndexOf("@");

  if (at < 1 || at === normalized.length - 1) return null;
  if (normalized.slice(at + 1) !== DOMAIN) return null;

  const localPart = normalized.slice(0, at);
  return Object.hasOwn(ROUTES, localPart) ? localPart : null;
}

function getSenderDomain(sender = "") {
  const normalized = String(sender).trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at > 0 && at < normalized.length - 1
    ? normalized.slice(at + 1)
    : "";
}

export function isBlockedSender(sender, env = {}) {
  const normalized = String(sender).trim().toLowerCase();
  const exact = csvSet(env.BLOCKED_SENDERS);
  const domains = csvSet(env.BLOCKED_DOMAINS);
  return exact.has(normalized) || domains.has(getSenderDomain(normalized));
}

function getLimit(env, key, fallback) {
  const value = Number(env[key]);
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function getRoute(localPart, env) {
  const bindingName = ROUTES[localPart];
  if (!bindingName) return null;
  return env[bindingName] || env.GMAIL_INBOX || null;
}

export function attachmentProblem(attachments, env = {}) {
  const maxCount = getLimit(env, "MAX_ATTACHMENTS", 10);
  const maxTotal = getLimit(
    env, "MAX_TOTAL_ATTACHMENT_BYTES", 10 * 1024 * 1024
  );

  if (attachments.length > maxCount) return "attachment_count_limit";

  let totalBytes = 0;

  for (const attachment of attachments) {
    const filename = safeText(attachment.filename || "").toLowerCase();
    const mime = safeText(
      attachment.mimeType || attachment.contentType || ""
    ).split(";")[0].trim().toLowerCase();

    const extension = filename.includes(".")
      ? filename.split(".").pop()
      : "";

    const content = attachment.content;
    const size = Number(content?.byteLength ?? content?.length ?? 0);
    totalBytes += Number.isFinite(size) && size > 0 ? size : 0;

    if (BLOCKED_EXTENSIONS.has(extension)) {
      return "blocked_attachment_extension";
    }
    if (BLOCKED_MIME_TYPES.has(mime)) {
      return "blocked_attachment_mime";
    }
  }

  if (totalBytes > maxTotal) return "attachment_size_limit";
  return null;
}

function audit(ctx, env, event) {
  const entry = {
    timestamp: new Date().toISOString(),
    from: safeText(event.from),
    to: safeText(event.to),
    result: safeText(event.result, 80),
    route: safeText(event.route, 80),
    reason: safeText(event.reason, 120)
  };

  // Do not log message bodies, subjects, attachment names, or raw MIME data.
  console.log(JSON.stringify({ event: "voidone_mail_audit", ...entry }));

  ctx.waitUntil((async () => {
    try {
      if (env.AUDIT_LOGS) {
        const key = `${Date.now()}-${crypto.randomUUID()}`;
        await env.AUDIT_LOGS.put(key, JSON.stringify(entry), {
          expirationTtl: AUDIT_TTL_SECONDS
        });
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "audit_storage_failed",
        message: safeText(error)
      }));
    }

    if (!env.SLACK_WEBHOOK_URL) return;
    if (env.SLACK_NOTIFY_ALL !== "true" && entry.result === "forwarded") return;

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
        event: "slack_notification_error",
        message: safeText(error)
      }));
    }
  })());
}

function reject(message, ctx, env, event, reason) {
  message.setReject(reason);
  audit(ctx, env, { ...event, result: "rejected", reason });
}

function headersFor(localPart, scanStatus) {
  const headers = new Headers();
  headers.set("X-VoidOne-Processed-By", "VoidOne-Mail-Gateway");
  headers.set("X-VoidOne-Route", localPart);
  headers.set("X-VoidOne-Scan", scanStatus);
  headers.set("X-VoidOne-Processed-At", new Date().toISOString());
  return headers;
}

export default {
  async email(message, env, ctx) {
    const base = {
      from: safeText(message.from),
      to: safeText(message.to)
    };

    const localPart = getLocalPart(message.to || "");
    const destination = localPart ? getRoute(localPart, env) : null;

    if (!localPart) {
      return reject(message, ctx, env, base, "unknown_recipient");
    }

    if (!destination) {
      return reject(
        message, ctx, env,
        { ...base, route: localPart },
        "destination_not_configured"
      );
    }

    if (!message.canBeForwarded) {
      return reject(
        message, ctx, env,
        { ...base, route: localPart },
        "message_cannot_be_forwarded"
      );
    }

    const maxMessageBytes = getLimit(
      env, "MAX_MESSAGE_BYTES", 15 * 1024 * 1024
    );

    if (Number(message.rawSize) > maxMessageBytes) {
      return reject(
        message, ctx, env,
        { ...base, route: localPart },
        "message_size_limit"
      );
    }

    if (isBlockedSender(message.from || "", env)) {
      return reject(
        message, ctx, env,
        { ...base, route: localPart },
        "blocked_sender"
      );
    }

    let scanStatus = "mime-checked";

    try {
      const parsed = await PostalMime.parse(message.raw);
      const attachments = Array.isArray(parsed.attachments)
        ? parsed.attachments
        : [];
      const problem = attachmentProblem(attachments, env);

      if (problem) {
        return reject(
          message, ctx, env,
          { ...base, route: localPart },
          problem
        );
      }
    } catch (error) {
      // Availability-first policy: preserve support mail, but mark scan failure.
      // Set STRICT_MIME_SCAN=true to reject messages that cannot be parsed.
      if (env.STRICT_MIME_SCAN === "true") {
        return reject(
          message, ctx, env,
          { ...base, route: localPart },
          "mime_scan_failed"
        );
      }

      scanStatus = "scan-error-forwarded";
      console.error(JSON.stringify({
        event: "mime_scan_failed",
        from: base.from,
        to: base.to,
        message: safeText(error)
      }));
    }

    try {
      await message.forward(destination, headersFor(localPart, scanStatus));

      audit(ctx, env, {
        ...base,
        route: localPart,
        result: scanStatus === "mime-checked"
          ? "forwarded"
          : "forwarded_scan_error",
        reason: scanStatus === "mime-checked" ? "" : "mime_parser_failed"
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: "forward_failed",
        from: base.from,
        to: base.to,
        route: localPart,
        message: safeText(error)
      }));

      if (env.GMAIL_INBOX && destination !== env.GMAIL_INBOX) {
        try {
          await message.forward(
            env.GMAIL_INBOX,
            headersFor(localPart, "fallback")
          );

          audit(ctx, env, {
            ...base,
            route: localPart,
            result: "forwarded_fallback",
            reason: "primary_destination_failed"
          });
          return;
        } catch (fallbackError) {
          console.error(JSON.stringify({
            event: "fallback_forward_failed",
            from: base.from,
            to: base.to,
            route: localPart,
            message: safeText(fallbackError)
          }));
        }
      }

      reject(
        message, ctx, env,
        { ...base, route: localPart },
        "forward_failed"
      );
    }
  }
};
