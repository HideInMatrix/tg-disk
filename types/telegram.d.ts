
export interface FileDetails {
  file_id: string;
  file_name: string;
  file_size: number;
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
