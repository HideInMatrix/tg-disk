
export interface FileDetails {
  file_id: string;
  file_name: string;
  file_size: number;
  // 消息级字段，用于后台管理删除对应的 Telegram 消息（deleteMessage 需要）
  message_id?: number;
  chat_id?: number | string;
}

export interface TelegramAPIResponse {
  ok: boolean;
  result: any;
  description?: string;
}

export interface SendFileParams {
  file: File;
  chatId: string;
  functionName: string;
  functionType: string;
  caption?: string;
  fileName?: string;
}

export interface TelegramAPIService {
  sendFile(params: SendFileParams): Promise<TelegramAPIResponse>;
  getFileInfo(responseData: TelegramAPIResponse): FileDetails | null;
  getFilePath(fileId: string): Promise<string | null>;
  getFileContent(fileId: string): Promise<Response>;
}
  interface TelegramFileType {
    type: string;
    method: string;
    fileName?: string; // fileName 可能不存在于某些情况中
  }