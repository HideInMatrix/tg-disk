// 包装原生 File 对象，自带状态和进度，方便列表渲染
 interface UploadableFile {
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