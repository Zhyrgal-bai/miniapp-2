import { API_BASE_URL } from "../../services/api";
import { withTenantHeaders } from "../../services/api";

export type UploadedImageAsset = {
  url: string;
  publicId: string;
  width: number;
  height: number;
};

export async function uploadImageToCdn(
  file: File,
  opts?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
): Promise<UploadedImageAsset> {
  const form = new FormData();
  form.append("file", file);
  const url = `${API_BASE_URL}/upload`;

  // Use XHR for upload progress in browsers.
  const out = await new Promise<UploadedImageAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    const headers = withTenantHeaders(undefined, url);
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v);
      }
    }
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      opts?.onProgress?.(pct);
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (${xhr.status})`));
        return;
      }
      try {
        const j = JSON.parse(xhr.responseText) as unknown;
        const obj: Record<string, unknown> =
          j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
        const asset: UploadedImageAsset = {
          url: String(obj.url ?? ""),
          publicId: String(obj.publicId ?? ""),
          width: Number(obj.width ?? 0) || 0,
          height: Number(obj.height ?? 0) || 0,
        };
        if (!asset.url || !asset.publicId) {
          reject(new Error("Bad upload response"));
          return;
        }
        resolve(asset);
      } catch {
        reject(new Error("Bad upload response"));
      }
    };
    if (opts?.signal) {
      const abort = () => {
        try {
          xhr.abort();
        } catch {
          // ignore
        }
        reject(new Error("Upload cancelled"));
      };
      if (opts.signal.aborted) return abort();
      opts.signal.addEventListener("abort", abort, { once: true });
    }
    xhr.send(form);
  });

  opts?.onProgress?.(100);
  return out;
}

