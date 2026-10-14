import test from "node:test";
import assert from "node:assert/strict";
import emailWorker, {
  attachmentProblem,
  csvSet,
  getLocalPart,
  isBlockedSender
} from "../src/index.js";

test("routes only known VoidOne addresses on the exact domain", () => {
  assert.equal(getLocalPart("support@voidone.dpdns.org"), "support");
  assert.equal(getLocalPart("SECURITY@voidone.dpdns.org"), "security");
  assert.equal(getLocalPart("admin@voidone.dpdns.org"), null);
  assert.equal(getLocalPart("support@sub.voidone.dpdns.org"), null);
  assert.equal(getLocalPart("support@example.com"), null);
});

test("normalizes comma-separated blocklists", () => {
  assert.deepEqual(
    [...csvSet(" spam@example.com,EXAMPLE.NET ,, ")],
    ["spam@example.com", "example.net"]
  );
});

test("blocks exact senders and configured domains", () => {
  const env = {
    BLOCKED_SENDERS: "spam@example.com",
    BLOCKED_DOMAINS: "bad.example"
  };
  assert.equal(isBlockedSender("SPAM@example.com", env), true);
  assert.equal(isBlockedSender("person@bad.example", env), true);
  assert.equal(isBlockedSender("person@good.example", env), false);
});

test("rejects executable-style attachment extensions", () => {
  assert.equal(
    attachmentProblem([{
      filename: "invoice.exe",
      mimeType: "application/octet-stream",
      content: new Uint8Array([1, 2, 3])
    }]),
    "blocked_attachment_extension"
  );
});

test("rejects attachment count and total size limits", () => {
  assert.equal(
    attachmentProblem(
      [{ filename: "a.txt" }, { filename: "b.txt" }],
      { MAX_ATTACHMENTS: "1" }
    ),
    "attachment_count_limit"
  );

  assert.equal(
    attachmentProblem([{
      filename: "large.txt",
      content: new Uint8Array(16)
    }], { MAX_TOTAL_ATTACHMENT_BYTES: "10" }),
    "attachment_size_limit"
  );
});

test("allows ordinary small attachments", () => {
  assert.equal(
    attachmentProblem([{
      filename: "readme.txt",
      mimeType: "text/plain",
      content: new Uint8Array([1, 2, 3])
    }]),
    null
  );
});

function mockMessage(overrides = {}) {
  const state = { rejected: null, forwardedTo: null, headers: null };
  const message = {
    from: "sender@example.net",
    to: "support@voidone.dpdns.org",
    canBeForwarded: true,
    rawSize: 100,
    raw: "From: sender@example.net\r\nTo: support@voidone.dpdns.org\r\nSubject: Test\r\n\r\nHello",
    setReject(reason) {
      state.rejected = reason;
    },
    async forward(destination, headers) {
      state.forwardedTo = destination;
      state.headers = headers;
    },
    ...overrides
  };
  return { message, state };
}

function mockContext() {
  const tasks = [];
  return {
    tasks,
    ctx: {
      waitUntil(promise) {
        tasks.push(promise);
      }
    }
  };
}

test("rejects with destination_not_configured when no inbox is configured", async () => {
  const { message, state } = mockMessage();
  const { ctx, tasks } = mockContext();

  await emailWorker.email(message, {}, ctx);
  await Promise.all(tasks);

  assert.equal(state.rejected, "destination_not_configured");
  assert.equal(state.forwardedTo, null);
});

test("forwards to GMAIL_INBOX when a route-specific inbox is absent", async () => {
  const { message, state } = mockMessage();
  const { ctx, tasks } = mockContext();

  await emailWorker.email(message, { GMAIL_INBOX: "team@example.net" }, ctx);
  await Promise.all(tasks);

  assert.equal(state.rejected, null);
  assert.equal(state.forwardedTo, "team@example.net");
  assert.equal(state.headers.get("X-VoidOne-Route"), "support");
});

test("prefers a route-specific inbox over GMAIL_INBOX", async () => {
  const { message, state } = mockMessage();
  const { ctx, tasks } = mockContext();

  await emailWorker.email(message, {
    GMAIL_INBOX: "general@example.net",
    SUPPORT_INBOX: "support-team@example.net"
  }, ctx);
  await Promise.all(tasks);

  assert.equal(state.rejected, null);
  assert.equal(state.forwardedTo, "support-team@example.net");
});
