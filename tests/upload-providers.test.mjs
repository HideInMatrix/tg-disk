import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import * as vue from "vue";

const root = new URL("../", import.meta.url);

function loadModule(path, imports = {}, globals = {}) {
  const source = readFileSync(new URL(path, root), "utf8");
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
  assert.deepEqual(Array.from(cloudflare().getIndexProviders()), ["telegram", "crossbell", "r2"]);
});

test("legacy environment and KV settings cannot restore the retired channel", async () => {
  const { getIndexProviders } = cloudflare("telegram,pinme,crossbell,r2");
  assert.deepEqual(Array.from(getIndexProviders()), ["telegram", "crossbell", "r2"]);
  const { getManagedProviders } = loadModule("server/utils/fileIndex.ts", {}, {
    getIndexProviders,
    kvGet: async () => ({ providers: ["pinme", "crossbell"] }),
  });
  assert.deepEqual(Array.from(await getManagedProviders()), ["crossbell"]);
});

for (const [disk, provider, prefix] of [
  ["telegram", "telegram", "file/"],
  ["ipfs", "crossbell", "ipfs/crossbell/"],
  ["r2", "r2", "r2/"],
]) {
  test(`${disk} upload uses ${provider} and records the correct link`, async () => {
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
      "~/composables/useIPFS": {
        useIPFS: () => ({
          progress: vue.ref(0),
          uploadFile: async () => {
            calls.push("crossbell");
            return { status: "ok", cid: "crossbell" };
          },
        }),
      },
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
      useRuntimeConfig: () => ({ public: { fileIndexProviders: "telegram,crossbell,r2" } }),
      useFileIndexEnabled: () => vue.ref(true),
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
  ]) {
    assert.equal(existsSync(fileURLToPath(new URL(path, root))), false);
  }
});
