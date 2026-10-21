import { api, toApiError } from '@/lib/api';

/** Save a Blob as a file. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download a file from the API (bearer token sent by axios); the server's filename wins. */
export async function downloadFile(url: string, fallbackName: string, params?: object) {
  try {
    const res = await api.get<Blob>(url, { params, responseType: 'blob', timeout: 0 });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
    saveBlob(res.data, name);
  } catch (err) {
    throw toApiError(err);
  }
}
