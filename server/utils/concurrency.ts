// server/utils/concurrency.ts

interface ChannelConfig {
  maxConcurrent: number;
  maxQueue: number;
  inFlight: number;
  queue: Array<() => void>;
}

const channels = new Map<string, ChannelConfig>();

function getChannel(name: string): ChannelConfig {
  if (!channels.has(name)) {
    channels.set(name, {
      maxConcurrent: 5, // 默认每个通道最大并发
      maxQueue: 100, // 默认最大等待队列长度
      inFlight: 0,
      queue: [],
    });
  }
  return channels.get(name)!;
}

/**
 * 可选：在项目启动时根据业务调节某个通道的并发/队列
 */
export function configureConcurrency(
  channelName: string,
  options: Partial<Pick<ChannelConfig, "maxConcurrent" | "maxQueue">>
) {
  const ch = getChannel(channelName);
  if (options.maxConcurrent != null) ch.maxConcurrent = options.maxConcurrent;
  if (options.maxQueue != null) ch.maxQueue = options.maxQueue;
}

async function acquire(channel: ChannelConfig) {
  if (channel.inFlight < channel.maxConcurrent) {
    channel.inFlight++;
    return;
  }

  if (channel.queue.length >= channel.maxQueue) {
    throw new Error("Too many pending requests, please try again later.");
  }

  await new Promise<void>((resolve) => {
    channel.queue.push(() => {
      channel.inFlight++;
      resolve();
    });
  });
}

function release(channel: ChannelConfig) {
  channel.inFlight--;
  const next = channel.queue.shift();
  if (next) next();
}

/**
 * 通用并发包装：指定一个通道名，限制该通道内 fn 的同时执行数量
 */
export async function withConcurrency<T>(
  channelName: string,
  fn: () => Promise<T>
): Promise<T> {
  const channel = getChannel(channelName);
  await acquire(channel);
  try {
    return await fn();
  } finally {
    release(channel);
  }
}

/**
 * 语义化的辅助封装：方便在业务里区分用途
 */
export const withRemoteFetch = <T>(fn: () => Promise<T>) =>
  withConcurrency("remote-fetch", fn);

export const withFileDownload = <T>(fn: () => Promise<T>) =>
  withConcurrency("file-download", fn);

export const withUpload = <T>(fn: () => Promise<T>) =>
  withConcurrency("upload", fn);
