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
