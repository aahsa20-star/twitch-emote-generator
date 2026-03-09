import type { BgRemovalQuality } from "@/types/emote";

export async function removeBackground(
  imageBlob: Blob,
  onProgress?: (progress: number) => void,
  quality: BgRemovalQuality = "speed"
): Promise<Blob> {
  const { removeBackground: removeBg } = await import(
    "@imgly/background-removal"
  );

  const result = await removeBg(imageBlob, {
    model: quality === "quality" ? "isnet" : "isnet_quint8",
    output: {
      format: "image/png",
      quality: 1,
    },
    progress: (key: string, current: number, total: number) => {
      if (onProgress && total > 0) {
        onProgress(Math.round((current / total) * 100));
      }
    },
  });

  return result;
}
