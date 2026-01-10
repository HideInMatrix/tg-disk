import { createError } from 'h3'
import { defaultHeaders } from '#imports'
import axios from "axios"
import {createHash} from 'crypto';
import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'

// Type definitions
interface ChunkSessionResponse {
  code: number;
  msg: string;
  data: {
    session_id: string;
    total_chunks: number;
    chunk_size: number;
  };
}


/**
 * 将 IPFS relay 返回的数据转换为标准格式（与 Telegram 保持一致）
 * @param responseData IPFS API 返回的数据
 * @returns 标准化的文件信息对象
 */
export function formatIPFSFileInfo(responseData: {
  status?: string
  cid?: string
  url?: string
  web2url?: string
  fileSize?: number
  fileName?: string
  [key: string]: any
}) {
  try {
    // 返回标准格式：{ file_id, file_name, file_size }
    return {
      file_id: responseData.cid || responseData.url || 'unknown',
      file_name: responseData.fileName || 'unknown',
      file_size: responseData.fileSize || 0
    }
  } catch (error) {
    console.error('[IPFS Format] 格式转换失败:', error)
    return null
  }
}

/**
 * 将本地代理 URL 转换为对应的 IPFS 网关 URL
 * 本地: /api/ipfs/crossbell/{cid}
 * 网关: https://ipfs.io/ipfs/{cid} 或其他自定义网关
 */
export function getIPFSProxyUrl(cid: string, baseUrl: string = '/api/ipfs/crossbell'): string {
  if (!cid) return ''
  return `${baseUrl}/${cid}`
}

export const useIPFS = async (file: File) => {
    const helia = await createHelia()
    const fs = unixfs(helia)
    console.log(fs);
    
}



const IPFS_API_URL = 'https://ipfs.glitterprotocol.dev/api/v2';
export async function initChunkSession(
  file: File,
  deviceId: string,
  isDirectory: boolean = false,
): Promise<ChunkSessionResponse['data']> {

  const fileName = file.name;
  const fileSize = file.size;
  
  const md5 = createHash('md5').update(await file.bytes()).digest('hex'); 

  console.log(fileName, fileSize, md5, deviceId);
  
  try {
    const response = await axios.post<ChunkSessionResponse>(
      `${IPFS_API_URL}/chunk/init`,
      {
        file_name: fileName,
        file_size: fileSize,
        md5: md5,
        is_directory: isDirectory,
        uid: deviceId,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const { code, msg, data } = response.data;
    if (code === 200 && data) {
      return data;
    }
    throw new Error(`Session initialization failed: ${msg} (code: ${code})`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Network error: ${error.message}`);
    }
    throw error;
  }
}

