// Run after NITRO_PRESET=cloudflare_pages pnpm build. No Cloudflare account or network required.
import assert from "node:assert/strict";

// Ignore local build-time auth/allowlist/S3 values in this isolated mock worker process.
const overrides = Object.fromEntries([
  "NUXT_PUBLIC_ACCOUNT", "NUXT_PUBLIC_PASSWORD", "NUXT_PUBLIC_ALLOW_HOSTS",
  "NUXT_PUBLIC_ALLOW_REFERERS", "NUXT_R2_ACCESS_KEY_ID", "NUXT_R2_SECRET_ACCESS_KEY",
  "NUXT_CF_ACCOUNT_ID", "NUXT_CF_API_TOKEN",
].map((name) => [name, ""]));
Object.assign(process.env, overrides);
const { default: worker } = await import("../dist/_worker.js/index.js");
const context = { waitUntil() {}, passThroughOnException() {} };

for (const name of ["NUXT_R2_BUCKET", "R2_BUCKET"]) {
  const objects = new Map();
  const bucket = {
    async put(key, body, options) {
      objects.set(key, { bytes: new Uint8Array(body), type: options.httpMetadata.contentType });
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: new Response(object.bytes).body,
        size: object.bytes.length,
        httpEtag: '"test-etag"',
        writeHttpMetadata(headers) { headers.set("Content-Type", object.type); },
      };
    },
    async delete(key) { objects.delete(key); },
  };
  const env = { ...overrides, [name]: bucket };
  const fetch = (path, options) => worker.fetch(new Request(`https://example.test${path}`, options), env, context);
  const status = await fetch("/api/files/status");
  assert.equal(status.status, 200);
  assert.equal((await status.json()).data.r2Enabled, true);

  const form = new FormData();
  form.append("file", new File(["binding-test"], "test.txt", { type: "text/plain" }));
  const upload = await fetch("/api/r2/send", { method: "POST", body: form });
  const result = await upload.json();
  assert.equal(result.code, 200);
  assert.ok(objects.has(result.data.file_id));
  assert.equal(objects.size, 1);

  const read = await fetch(`/r2/${result.data.file_id}`);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("Content-Type"), "text/plain");
  assert.equal(read.headers.get("Content-Length"), "12");
  assert.equal(read.headers.get("ETag"), '"test-etag"');
  assert.equal(await read.text(), "binding-test");
  assert.equal((await fetch("/r2/missing", { headers: { accept: "application/json" } })).status, 404);
  console.log(`${name}: built Pages worker status/upload/read/404 passed`);
}

const status = await worker.fetch(new Request("https://example.test/api/files/status"), overrides, context);
assert.equal((await status.json()).data.r2Enabled, false);
console.log("No binding: disabled; no cross-request binding leakage. No production objects touched.");
