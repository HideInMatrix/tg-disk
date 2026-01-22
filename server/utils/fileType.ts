
export function getMimeType(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
  };
  return map[ext || ""] || null;
}
