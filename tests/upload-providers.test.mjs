import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import * as vue from "vue";

const root = new URL("../", import.meta.url);
const requireVue = createRequire(import.meta.resolve("vue"));
const { parse, compileScript } = requireVue("@vue/compiler-sfc");
const { renderToString } = requireVue("@vue/server-renderer");

function loadModule(path, imports = {}, globals = {}, source = readFileSync(new URL(path, root), "utf8")) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
    console, File, URL, ...globals,
  }, { filename: path });
  return exports;
}

function cloudflare(providers) {
  return loadModule("server/utils/cloudflare.ts", {}, {
    useRuntimeConfig: () => ({ public: { fileIndexProviders: providers } }),
  });
}

test("provider defaults exclude the retired channel", () => {
  assert.deepEqual(Array.from(cloudflare().getIndexProviders()), ["telegram", "r2"]);
});

test("legacy environment and KV settings cannot restore the retired channel", async () => {
  const { getIndexProviders } = cloudflare("telegram,pinme,crossbell,r2");
  assert.deepEqual(Array.from(getIndexProviders()), ["telegram", "r2"]);
  const { getManagedProviders } = loadModule("server/utils/fileIndex.ts", {}, {
    getIndexProviders,
    kvGet: async () => ({ providers: ["pinme", "crossbell", "r2"] }),
  });
  assert.deepEqual(Array.from(await getManagedProviders()), ["r2"]);
});

for (const [disk, provider, prefix, enabled] of [
  ["telegram", "telegram", "file/", true],
  ["r2", "r2", "r2/", true],
  ["r2", "r2", "r2/", false],
]) {
  test(`${disk} upload with R2 enabled=${enabled} routes safely`, async () => {
    const calls = [];
    const records = [];
    const upload = (name) => async () => {
      calls.push(name);
      return { code: 200, data: { file_id: name } };
    };
    const { useUploadLimit } = loadModule("app/composables/useUploadLimit.ts", { vue });
    const { useFileUpload } = loadModule("app/composables/useFileUpload.ts", {
      vue,
      uuid: { v4: randomUUID },
      "~/composables/useTelegram": {
        uploadFileToTelegram: upload("telegram"),
        uploadUrlToTelegram: upload("telegram-url"),
      },
      "~/composables/useR2": { uploadFileToR2: upload("r2") },
      "~/composables/useUploadLimit": { useUploadLimit },
      "@/lib/filePreview": {
        getFileName: () => "example.txt",
        resolveFilePreviewMeta: () => ({ fileType: "text", fileExtension: "txt" }),
      },
    }, {
      useRuntimeConfig: () => ({ public: { fileIndexProviders: "telegram,r2" } }),
      useFileIndexEnabled: () => vue.ref(true),
      useR2Enabled: () => vue.ref(enabled),
      $fetch: async (_url, options) => records.push(options.body),
    });
    let complete;
    const done = new Promise((resolve) => { complete = resolve; });
    const uploader = useFileUpload({ onUploaded: complete });
    uploader.uploadType.value = "url";
    uploader.uploadDisk.value = disk;
    await vue.nextTick();
    assert.equal(uploader.uploadType.value, disk === "telegram" ? "url" : "file");
    uploader.uploadType.value = "file";
    uploader.addFiles([new File(["test"], "example.txt")]);
    await done;
    if (!enabled) {
      assert.equal(uploader.files.value[0].status, "error");
      assert.deepEqual(calls, []);
      assert.deepEqual(records, []);
      uploader.clearAll();
      return;
    }
    assert.deepEqual(calls, [provider]);
    assert.equal(uploader.files.value[0].status, "done");
    assert.equal(uploader.files.value[0].url, `${prefix}${provider}`);
    assert.equal(records.length, 1);
    assert.equal(records[0].provider, provider);
    assert.equal(records[0].url, `${prefix}${provider}`);
    uploader.clearAll();
  });
}

test("retired upload module and proxy route are removed", () => {
  for (const path of [
    "app/composables/usePinMeIPFS.ts",
    "server/routes/ipfs/pinme/[...path].get.ts",
    "app/composables/useIPFS.ts",
    "server/routes/ipfs/crossbell/[...path].get.ts",
    "server/api/ipfs/send.post.ts",
  ]) {
    assert.equal(existsSync(fileURLToPath(new URL(path, root))), false);
  }
});


test("R2 configuration is independent of D1 and KV", () => {
  const config = {
    cf: { accountId: "account" },
    r2: { accessKeyId: "access", secretAccessKey: "secret", bucket: "files" },
  };
  const { isR2Enabled } = loadModule("server/utils/r2.ts", { aws4fetch: {} }, {
    useRuntimeConfig: () => config,
  });
  assert.equal(isR2Enabled(), true);
  delete config.r2.bucket;
  assert.equal(isR2Enabled(), false);
});

const wrapper = vue.defineComponent({
  props: ["modelValue", "value", "disabled"],
  setup: (props, { slots }) => () => vue.h("div", {
    "data-value": props.value,
    "data-disabled": String(Boolean(props.disabled)),
  }, slots.default?.()),
});

for (const enabled of [false, true]) {
  test(`Cloudflare R2 tab remains visible when enabled=${enabled}`, async () => {
    const path = "app/components/upload/UploadToolbar.vue";
    const { descriptor } = parse(readFileSync(new URL(path, root), "utf8"));
    const compiled = compileScript(descriptor, { id: "upload-toolbar-test", inlineTemplate: true });
    const { default: component } = loadModule(path, {
      vue,
      "@/components/ui/tabs": { Tabs: wrapper, TabsList: wrapper, TabsTrigger: wrapper },
      "vue-sonner": { toast: {} },
      "lucide-vue-next": { LockKeyhole: wrapper, LockKeyholeOpen: wrapper },
    }, {
      useUserSession: () => ({ loggedIn: vue.ref(true) }),
      useRuntimeConfig: () => ({ public: {} }),
      useR2Enabled: () => vue.ref(enabled),
    }, compiled.content);
    const html = await renderToString(vue.createSSRApp(component, {
      uploadDisk: "r2", uploadType: "file", stats: { pending: 0, success: 0, error: 0 }, files: [],
    }));
    assert.match(html, /data-value="r2"/);
    assert.match(html, /Cloudflare R2/);
    assert.doesNotMatch(html, /Crossbell|IPFS|PinMe/);
    assert.match(html, new RegExp(`data-value="file" data-disabled="${!enabled}"`));
    assert.equal(html.includes("未配置"), !enabled);
  });
}

function r2Module(config = {}, fetch = () => { throw new Error("Unexpected S3 fallback"); }) {
  let clients = 0;
  const api = loadModule("server/utils/r2.ts", {
    aws4fetch: { AwsClient: class {
      constructor() { clients++; }
      fetch(...args) { return fetch(...args); }
    } },
  }, {
    useRuntimeConfig: () => config,
    createError: (details) => Object.assign(new Error(details.message), details),
    Response, Headers,
    console: { error() {} },
  });
  return { ...api, clients: () => clients };
}

function boundEvent(bucket, name = "NUXT_R2_BUCKET") {
  return { context: { cloudflare: { env: { [name]: bucket } } } };
}

function mockBucket(overrides = {}) {
  return { put: async () => {}, get: async () => null, delete: async () => {}, ...overrides };
}

for (const name of ["NUXT_R2_BUCKET", "R2_BUCKET"]) {
  test(`Pages ${name} binding enables R2 without credentials and stays request-local`, () => {
    const api = r2Module();
    assert.equal(api.isR2Enabled(boundEvent(mockBucket(), name)), true);
    assert.equal(api.isR2Enabled({ context: {} }), false);
    assert.equal(api.isR2Enabled(boundEvent("tg-disk", name)), false);
    assert.equal(api.isR2Enabled(boundEvent({ put() {}, get() {} }, name)), false);
    assert.equal(api.clients(), 0);
  });
}

test("native binding handles upload, streamed read metadata, missing objects and delete", async () => {
  const calls = [];
  const body = new Uint8Array([1, 2, 3]);
  const bucket = mockBucket({
    put: async (...args) => calls.push(["put", ...args]),
    get: async (key) => key === "missing" ? null : {
      body: new Response(body).body,
      size: body.length,
      httpEtag: '"native-etag"',
      writeHttpMetadata: (headers) => headers.set("Content-Type", "image/png"),
    },
    delete: async (key) => calls.push(["delete", key]),
  });
  const event = boundEvent(bucket);
  const api = r2Module();
  await api.r2Put("folder/test.png", body, "image/png", event);
  assert.equal(calls[0][1], "folder/test.png");
  assert.equal(calls[0][2], body);
  assert.equal(calls[0][3].httpMetadata.contentType, "image/png");
  const response = await api.r2Get("folder/test.png", event);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-length"), "3");
  assert.equal(response.headers.get("etag"), '"native-etag"');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body);
  assert.equal((await api.r2Get("missing", event)).status, 404);
  assert.equal(await api.r2Delete("folder/test.png", event), true);
  assert.deepEqual(calls[1], ["delete", "folder/test.png"]);
  assert.equal(api.clients(), 0);
});

const s3Config = {
  cf: { accountId: "account" },
  r2: { accessKeyId: "access", secretAccessKey: "secret", bucket: "files" },
};

test("binding errors never fall back to S3 even when credentials are present", async () => {
  const fail = async () => { throw new Error("Binding failure"); };
  const event = boundEvent(mockBucket({ put: fail, get: fail, delete: fail }));
  const api = r2Module(s3Config);
  await assert.rejects(api.r2Put("key", new Uint8Array(), "text/plain", event), { statusCode: 502 });
  await assert.rejects(api.r2Get("key", event), { statusCode: 502 });
  assert.equal(await api.r2Delete("key", event), false);
  assert.equal(api.clients(), 0);
});

test("self-hosted S3 fallback retains put/get/delete and URL escaping", async () => {
  const calls = [];
  const api = r2Module(s3Config, async (url, options) => {
    calls.push({ url, options });
    return options.method === "DELETE" ? new Response(null, { status: 404 }) : new Response("ok");
  });
  const event = { context: {} };
  await api.r2Put("folder/a b#.txt", new Uint8Array([1]), "text/plain", event);
  assert.equal(await (await api.r2Get("folder/a b#.txt", event)).text(), "ok");
  assert.equal(await api.r2Delete("folder/a b#.txt", event), true);
  assert.deepEqual(calls.map(({ options }) => options.method), ["PUT", "GET", "DELETE"]);
  assert.ok(calls.every(({ url }) => url === "https://account.r2.cloudflarestorage.com/files/folder/a%20b%23.txt"));
  assert.equal(calls[0].options.headers["content-type"], "text/plain");
  assert.equal(api.clients(), 3);
});

test("public status uses the current request binding rather than global configuration", () => {
  const api = r2Module();
  const handler = loadModule("server/api/files/status.get.ts", {}, {
    defineEventHandler: (handler) => handler,
    isFileIndexEnabled: () => false,
    getIndexProviders: () => [],
    isR2Enabled: api.isR2Enabled,
  }).default;
  assert.equal(handler(boundEvent(mockBucket())).data.r2Enabled, true);
  assert.equal(handler({ context: {} }).data.r2Enabled, false);
});

test("multipart upload propagates event and preserves login enforcement", async () => {
  const event = boundEvent(mockBucket());
  const data = Buffer.from("hello");
  const calls = [];
  const handler = loadModule("server/api/r2/send.post.ts", {}, {
    defineEventHandler: (handler) => handler,
    isR2Enabled: (current) => { assert.equal(current, event); return true; },
    useRuntimeConfig: (current) => {
      assert.equal(current, event);
      return { public: { account: "user", password: "password" } };
    },
    requireUserSession: async (current) => { assert.equal(current, event); calls.push("auth"); },
    readMultipartFormData: async () => [{ name: "file", filename: "hello.txt", type: "text/plain", data }],
    crypto: { randomUUID: () => "uuid" },
    r2Put: async (key, body, type, current) => {
      assert.equal(current, event);
      assert.equal(key, "uuid.txt");
      assert.equal(body, data);
      assert.equal(type, "text/plain");
      calls.push("put");
    },
  }).default;
  assert.equal((await handler(event)).code, 200);
  assert.deepEqual(calls, ["auth", "put"]);
});

test("private-bucket download forwards event, stream, length, type and etag", async () => {
  const event = boundEvent(mockBucket());
  const response = new Response("hello", { headers: {
    "Content-Type": "text/plain", "Content-Length": "5", ETag: '"etag"',
  } });
  const headers = {};
  const handler = loadModule("server/routes/r2/[...path].get.ts", {
    h3: { createError: (details) => Object.assign(new Error(details.message), details) },
    "~~/server/utils/fileType": { getMimeType: () => "application/octet-stream" },
  }, {
    defineEventHandler: (handler) => handler,
    isR2Enabled: (current) => { assert.equal(current, event); return true; },
    getRouterParams: () => ({ path: ["folder", "hello.txt"] }),
    r2Get: async (key, current) => {
      assert.equal(current, event);
      assert.equal(key, "folder/hello.txt");
      return response;
    },
    setHeader: (current, name, value) => { assert.equal(current, event); headers[name] = value; },
    sendStream: (current, body) => { assert.equal(current, event); return body; },
  }).default;
  assert.equal(await handler(event), response.body);
  assert.equal(headers["Content-Type"], "text/plain");
  assert.equal(headers["Content-Length"], "5");
  assert.equal(headers.ETag, '"etag"');
});

test("indexed R2 deletion propagates the request binding from API to bucket", async () => {
  const event = boundEvent(mockBucket());
  const queries = [];
  const { deleteFile } = loadModule("server/utils/fileIndex.ts", {}, {
    getIndexProviders: () => ["r2"],
    kvGet: async () => null,
    ensureFileIndexSchema: async () => {},
    d1Query: async (sql) => {
      queries.push(sql);
      return { results: sql.startsWith("SELECT") ? [{ id: "id", provider: "r2", ref_id: "key", url: "r2/key" }] : [] };
    },
    r2Delete: async (key, current) => {
      assert.equal(key, "key");
      assert.equal(current, event);
      return true;
    },
  });
  const handler = loadModule("server/api/files/[id].delete.ts", {}, {
    defineEventHandler: (handler) => handler,
    assertFileIndex: async (current) => assert.equal(current, event),
    getRouterParam: () => "id",
    deleteFile,
  }).default;
  assert.equal((await handler(event)).data.deleted, true);
  assert.ok(queries.some((sql) => sql.startsWith("DELETE")));
});
