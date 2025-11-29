import { ref, computed } from "vue";
import { v4 as uuidv4 } from "uuid";

export type UploadStatus = "pending" | "uploading" | "done" | "error";

// 包装原生 File 对象，自带状态和进度，方便列表渲染
export interface UploadableFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  response: any;
  url: string; // 预览图 URL
}

interface UseFileUploadOptions {
  uploadUrl?: string;
  extraFormData?: Record<string, string>;
  concurrency?: number; // 最大并发数，默认 3
  onUploaded?: (responses: any[]) => void;
}

type UploadType = "file" | "url";

type UploadDisk = "telegram" | "ipfs";

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

  interface TelegramFileType {
    type: string;
    method: string;
    fileName?: string; // fileName 可能不存在于某些情况中
  }

  function getTelegramFileType(
    file: File | string
  ): TelegramFileType | undefined {
    // 判断 file 是否是 URL 字符串
    if (typeof file === "string") {
      const ext = file.split(".").pop()?.toLowerCase();
      const fileName = file.split("/").pop()?.split("?")[0] || "unknown";

      // 判断 URL 后缀来确定文件类型
      if (ext) {
        if (["jpg", "jpeg", "png", "gif"].includes(ext)) {
          return ext === "gif"
            ? { type: "animation", method: "sendAnimation", fileName }
            : { type: "photo", method: "sendPhoto", fileName };
        }
        if (["mp3", "ogg", "wav"].includes(ext)) {
          return { type: "audio", method: "sendAudio", fileName };
        }
        if (["mp4", "mov", "avi"].includes(ext)) {
          return { type: "video", method: "sendVideo", fileName };
        }
        // 默认返回 document
        return { type: "document", method: "sendDocument", fileName };
      }
    } else {
      // 如果是 File 对象
      const ext = file.name.split(".").pop()?.toLowerCase();
      const mime = file.type.toLowerCase();

      if (mime.includes("image")) {
        return ext === "gif"
          ? { type: "animation", method: "sendAnimation", fileName: file.name }
          : { type: "photo", method: "sendPhoto", fileName: file.name };
      }
      if (mime.includes("audio"))
        return { type: "audio", method: "sendAudio", fileName: file.name };
      if (mime.includes("video"))
        return { type: "video", method: "sendVideo", fileName: file.name };
      return { type: "document", method: "sendDocument", fileName: file.name };
    }

    // 如果没有匹配的类型，返回 undefined
    return undefined;
  }

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
    return new Promise((resolve, reject) => {
      const index = files.value.findIndex((f) => f.id === uFile.id);
      if (!files.value[index]) {
        throw new Error("Error File Index");
      }
      files.value[index].status = "uploading";

      const xhr = new XMLHttpRequest();
      const url = options.uploadUrl || "/api/telegram/send";
      xhr.open("POST", url);

      const fileInfo = getTelegramFileType(uFile.file);
      if (fileInfo === undefined) {
        throw new Error("Unsupported file type for Telegram upload");
      }
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          if (!files.value[index]) {
            throw new Error("Error File Index");
          }
          files.value[index].progress = Math.round((e.loaded / e.total) * 100);
        }
      };

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.code !== 200) throw new Error("Backend Error");
          if (!files.value[index]) {
            throw new Error("Error File Index");
          }
          files.value[index].status = "done";
          files.value[index].progress = 100;
          files.value[index].response = res;
          resolve(res);
        } catch (err) {
          if (!files.value[index]) {
            throw new Error("Error File Index");
          }
          files.value[index].status = "error";
          reject(err);
        }
      };

      xhr.onerror = () => {
        if (!files.value[index]) {
          throw new Error("Error File Index");
        }
        files.value[index].status = "error";
        reject(new Error("Network Error"));
      };

      const fd = new FormData();
      fd.append("file", uFile.file);
      fd.append("fileName", uFile.file.name);
      //   fd.append("functionType", fileInfo?.type);
      //   fd.append("functionName", fileInfo?.method);

      if (options.extraFormData) {
        Object.entries(options.extraFormData).forEach(([k, v]) =>
          fd.append(k, v)
        );
      }

      xhr.send(fd);
    });
  }

  function uploadToIPFS(uFile: UploadableFile): Promise<void> {
    return new Promise((resolve, reject) => {
      const index = files.value.findIndex((f) => f.id === uFile.id);
      if (!files.value[index]) {
        throw new Error("Error File Index");
      }

      files.value[index].status = "uploading";

      const formData = new FormData();
      formData.append("file", uFile.file, uFile.file.name);
      formData.append("deviceId", uuidv4());
      formData.append("fileName", uFile.file.name);

      const url = options.uploadUrl || "/api/ipfs/send"; // 假设IPFS上传的API
      const xhr = new XMLHttpRequest();

      xhr.open("POST", url);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          if (!files.value[index]) {
            throw new Error("Error File Index");
          }
          files.value[index].progress = Math.round((e.loaded / e.total) * 100);
        }
      };

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.code !== 200) throw new Error("Backend Error");
          if (!files.value[index]) {
            throw new Error("Error File Index");
          }
          files.value[index].status = "done";
          files.value[index].progress = 100;
          files.value[index].response = res;
          files.value[index].url = res.data.url; // 假设返回一个url
          resolve(res);
        } catch (err) {
          if (!files.value[index]) {
            throw new Error("Error File Index");
          }
          files.value[index].status = "error";
          reject(err);
        }
      };

      xhr.onerror = () => {
        if (!files.value[index]) {
          throw new Error("Error File Index");
        }
        files.value[index].status = "error";
        reject(new Error("Network Error"));
      };

      xhr.send(formData);
    });
  }

  function uploadToTelegramByUrl(uFile: UploadableFile): Promise<void> {
    return new Promise((resolve, reject) => {
      const index = files.value.findIndex((f) => f.id === uFile.id);
      if (!files.value[index]) {
        throw new Error("Error File Index");
      }
      files.value[index].status = "uploading";

      const xhr = new XMLHttpRequest();
      const url = options.uploadUrl || "/api/telegram/url";
      xhr.open("POST", url);

      const fileInfo = getTelegramFileType(uFile.url);
      if (fileInfo === undefined) {
        throw new Error("Unsupported file type for Telegram upload");
      }
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          if (!files.value[index]) {
            throw new Error("Error File Index");
          }
          files.value[index].progress = Math.round((e.loaded / e.total) * 100);
        }
      };

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.code !== 200) throw new Error("Backend Error");
          if (!files.value[index]) {
            throw new Error("Error File Index");
          }
          files.value[index].status = "done";
          files.value[index].progress = 100;
          files.value[index].response = res;
          resolve(res);
        } catch (err) {
          if (!files.value[index]) {
            throw new Error("Error File Index");
          }
          files.value[index].status = "error";
          reject(err);
        }
      };

      xhr.onerror = () => {
        if (!files.value[index]) {
          throw new Error("Error File Index");
        }
        files.value[index].status = "error";
        reject(new Error("Network Error"));
      };

      const fd = new FormData();
      fd.append("file", uFile.url);
      fd.append("fileName", uFile.url.split("/").pop() || "file.jpeg");
      //   fd.append("functionType", fileInfo.type);
      //   fd.append("functionName", fileInfo.method);

      if (options.extraFormData) {
        Object.entries(options.extraFormData).forEach(([k, v]) =>
          fd.append(k, v)
        );
      }

      xhr.send(fd);
    });
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
