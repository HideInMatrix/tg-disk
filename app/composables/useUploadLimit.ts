import { computed, toValue, type MaybeRefOrGetter } from "vue"

export const BYTES_PER_MIB = 1024 * 1024

const formatter = new Intl.NumberFormat("en-US")

function formatBytes(bytes: number): string {
  return `${formatter.format(bytes)} Bytes`
}

function formatMiB(bytes: number, digits = 2): string {
  return `${(bytes / BYTES_PER_MIB).toFixed(digits)} MiB`
}

function createLimit(maxMiB: number) {
  const maxBytes = maxMiB * BYTES_PER_MIB
  return {
    maxMiB,
    maxBytes,
    maxMiBLabel: `${maxMiB} MiB`,
    maxBytesLabel: formatBytes(maxBytes),
  }
}

export function useUploadLimit(currentDisk?: MaybeRefOrGetter<UploadDisk>) {
  const limits = computed(() => ({
    telegram: createLimit(10),
    ipfs: createLimit(15),
  }))

  const currentLimit = computed(() => {
    const disk = currentDisk ? toValue(currentDisk) : "telegram"
    return limits.value[disk]
  })

  return {
    limits,
    currentLimit,
    formatBytes,
    formatMiB,
  }
}
