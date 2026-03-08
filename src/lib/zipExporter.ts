import JSZip from "jszip";
import { EmoteVariant } from "@/types/emote";

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function exportAsZip(
  variants: EmoteVariant[],
  zipFilename: string = "emotes.zip"
): Promise<void> {
  const zip = new JSZip();

  for (const variant of variants) {
    if (variant.animatedBlob) {
      const buffer = await blobToArrayBuffer(variant.animatedBlob);
      zip.file(variant.filename, buffer);
    } else {
      const bytes = dataUrlToUint8Array(variant.staticDataUrl);
      zip.file(variant.filename, bytes);
    }
  }

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  // Delay cleanup to ensure download starts
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
