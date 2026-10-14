import test from "node:test";
import assert from "node:assert/strict";
import {
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
    attachmentProblem(
      [{
        filename: "large.txt",
        content: new Uint8Array(16)
      }],
      { MAX_TOTAL_ATTACHMENT_BYTES: "10" }
    ),
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
