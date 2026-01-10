import { ref, computed, watch } from "vue";
import { v4 as uuidv4 } from "uuid";
import { useIPFS } from "~/composables/useIPFS";
import { uploadFileToTelegram, uploadUrlToTelegram } from "~/composables/useTelegram";

export type UploadStatus = "pending" | "uploading" | "done" | "error";



export function useFileUpload(options: UseFileUploadOptions = {}) {
  const files = ref<UploadableFile[]>([]);

  const uploadType = ref<UploadType>("file");
  const uploadDisk = ref<UploadDisk>("telegram");

  // 统计计算属性
  const stats = computed(() => {
    return {
      pending: files.value.filter(
        (f) => f.status === "pending" || f.status === "uploading"
      ).length,
      success: files.value.filter((f) => f.status === "done").length,
      error: files.value.filter((f) => f.status === "error").length,
      total: files.value.length,
    };
  });

  // 核心上传逻辑 分别是telegram和ipfs上传
  function uploadSingleFile({
    uFile,
    index,
  }: {
    uFile?: UploadableFile;
    index: number;
  }): Promise<void> {
    if (
      uploadDisk.value === "telegram" &&
      uploadType.value === "file" &&
      uFile
    ) {
      return uploadToTelegram(uFile);
    } else if (
      uploadDisk.value === "telegram" &&
      uploadType.value === "url" &&
      uFile
    ) {
      return uploadToTelegramByUrl(uFile);
    } else if (
      uploadDisk.value === "ipfs" &&
      uploadType.value === "file" &&
      uFile
    ) {
      return uploadToIPFS(uFile);
    } else {
      return Promise.reject(new Error("Unsupported upload type or disk"));
    }
  }

  // 并发队列控制
  const concurrency = ref<number>(options.concurrency ?? 3);
  const activeCount = ref<number>(0);
  const queue: Array<() => Promise<void>> = [];

  function setConcurrency(n: number) {
    concurrency.value = Math.max(1, Math.floor(n));
    // 触发队列执行，可能有更多插槽
    runQueue();
  }

  function runQueue() {
    // 当还有位置且队列有任务时，取任务执行
    while (activeCount.value < concurrency.value && queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      activeCount.value++;
      // 执行任务，完成后递减 activeCount 并继续执行队列
      task()
        .catch(() => {
          // 错误在任务内部已经标记状态
        })
        .finally(() => {
          activeCount.value--;
          // 递归执行后续任务
          runQueue();
        });
    }
  }

  // 添加文件
  function addFiles(newRawFiles: File[] | string[]) {
    const newUploadables: UploadableFile[] = [];

    if (uploadType.value === "file") {
      newRawFiles.forEach((file) => {
        if (typeof file === "string") return; // Skip if not a File
        newUploadables.push({
          id: uuidv4(),
          file,
          status: "pending",
          progress: 0,
          response: null,
          url: URL.createObjectURL(file), // 生成预览 URL
        });
      });
    } else if (uploadType.value === "url") {
      newRawFiles.forEach((file) => {
        if (typeof file !== "string") return; // Skip if not a string URL
        newUploadables.push({
          id: uuidv4(),
          file: new File([], file.split("/").pop()?.split(".").shift() || ""), // 创建一个空的 File 对象作为占位符
          status: "pending",
          progress: 0,
          response: null,
          url: file, // 直接使用 URL 作为预览
        });
      });
    }
    files.value = [...files.value, ...newUploadables];

    // 为每个待上传文件建立一个 Promise，用来通知该批次上传完成
    const settlePromises: Promise<void>[] = [];
    newUploadables.forEach((uFile) => {
      if (uFile.status === "done") return;
      let resolv: () => void;
      const p = new Promise<void>((resolve) => {
        resolv = resolve;
      });
      settlePromises.push(p as Promise<void>);

      // 将任务加入队列
      const task = () =>
        uploadSingleFile({ uFile, index: -1 }).finally(() => {
          // 无论成功或失败，都通知这一项已完成（用于 onUploaded 回调判断）
          resolv && resolv();
        });

      queue.push(task);
    });

    // 触发队列执行
    runQueue();

    Promise.allSettled(settlePromises).then(() => {
      if (options.onUploaded) {
        const responses = files.value
          .filter((f) => f.status === "done")
          .map((f) => f.response);
        options.onUploaded(responses);
      }
    });
  }

  function retryFailed() {
    const settlePromises: Promise<void>[] = [];
    files.value.forEach((f) => {
      if (f.status === "error") {
        f.status = "pending";
        f.progress = 0;
        let resolv: () => void;
        const p = new Promise<void>((resolve) => {
          resolv = resolve;
        });
        settlePromises.push(p as Promise<void>);
        const task = () =>
          uploadSingleFile({ uFile: f, index: -1 }).finally(() => {
            resolv && resolv();
          });
        queue.push(task);
      }
    });
    runQueue();
    // 可选：等待所有重试完成后触发回调
    Promise.allSettled(settlePromises).then(() => {
      if (options.onUploaded) {
        const responses = files.value
          .filter((f) => f.status === "done")
          .map((f) => f.response);
        options.onUploaded(responses);
      }
    });
  }

  function clearAll() {
    // 清空文件列表，清空队列，保留正在上传的任务（不能取消xhr）
    files.value = [];
    queue.splice(0, queue.length);
  }

  function clearSuccess() {
    files.value = files.value.filter((f) => f.status !== "done");
  }

  function uploadToTelegram(uFile: UploadableFile): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const index = files.value.findIndex((f) => f.id === uFile.id);
      if (!files.value[index]) return reject(new Error("Error File Index"));
      files.value[index].status = "uploading";

      try {
        const res = await uploadFileToTelegram(uFile, { uploadUrl: options.uploadUrl, extraFormData: options.extraFormData }, (p) => {
          if (files.value[index]) files.value[index].progress = p;
        });

        if (!files.value[index]) return reject(new Error("Error File Index"));
        files.value[index].status = "done";
        files.value[index].progress = 100;
        files.value[index].response = res;
        files.value[index].url = `file/${res.data.file_id}`
        resolve(res);
      } catch (err) {
        if (files.value[index]) files.value[index].status = "error";
        reject(err);
      }
    });
  }
  function uploadToTelegramByUrl(uFile: UploadableFile): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const index = files.value.findIndex((f) => f.id === uFile.id);
      if (!files.value[index]) return reject(new Error("Error File Index"));
      files.value[index].status = "uploading";

      try {
        const res = await uploadUrlToTelegram(uFile, { uploadUrl: options.uploadUrl, extraFormData: options.extraFormData }, (p) => {
          if (files.value[index]) files.value[index].progress = p;
        });

        if (!files.value[index]) return reject(new Error("Error File Index"));
        files.value[index].status = "done";
        files.value[index].progress = 100;
        files.value[index].response = res;
        files.value[index].url = `file/${res.data.file_id}`
        resolve(res);
      } catch (err) {
        if (files.value[index]) files.value[index].status = "error";
        reject(err);
      }
    });
  }

  function uploadToIPFS(uFile: UploadableFile): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const index = files.value.findIndex((f) => f.id === uFile.id)
      if (!files.value[index]) return reject(new Error('Error File Index'))
      files.value[index].status = 'uploading'

      try {
        // useIPFS composable provides uploadFile and progress
        const { uploadFile, progress } = useIPFS()
        const unwatch = watch(progress, (p) => {
          if (files.value[index]) files.value[index].progress = p
        })

        const result = await uploadFile(uFile.file)

        if (!files.value[index]) {
          unwatch()
          return reject(new Error('Error File Index'))
        }

        const standardizedResponse = {
          code: 200,
          msg: 'ok',
          data: {
            file_id: result.cid || result.url || 'unknown',
            file_name: uFile.file.name,
            file_size: uFile.file.size,
            cid: result.cid,
          },
        }

        files.value[index].status = 'done'
        files.value[index].progress = 100
        files.value[index].response = standardizedResponse
        files.value[index].url = `ipfs/crossbell/${standardizedResponse.data.cid}`

        unwatch()
        resolve(standardizedResponse as any)
      } catch (err) {
        if (files.value[index]) files.value[index].status = 'error'
        reject(err)
      }
    })
  }



  return {
    uploadType,
    uploadDisk,
    files,
    stats,
    addFiles,
    retryFailed,
    clearAll,
    clearSuccess,
    concurrency,
    setConcurrency,
  };
}
