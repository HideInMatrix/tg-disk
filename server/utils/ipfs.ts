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

