import type { SavedFileItem } from '../types';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function formatTimestamp(ts: unknown, lang: 'om' | 'en' = 'om'): string {
  if (!ts) return '';
  let date: Date | null = null;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return '';
  return new Intl.DateTimeFormat(lang === 'om' ? 'en-GB' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function base64ToBlobUrl(dataBase64: string, mimeType: string): string {
  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  return URL.createObjectURL(blob);
}

export async function resolveFileBlobUrl(file: SavedFileItem): Promise<string> {
  const res = await fetch(`${file.downloadUrl}?name=${encodeURIComponent(file.fileName)}`);
  if (res.ok) {
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  throw new Error('File content is unavailable.');
}

export async function triggerFileDownload(file: SavedFileItem): Promise<void> {
  const objectUrl = await resolveFileBlobUrl(file);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

export async function resolveUrlOrBase64Blob(
  url?: string,
  base64?: string,
  mimeType?: string,
  fileName?: string
): Promise<string> {
  if (url) {
    try {
      const res = await fetch(`${url}?name=${encodeURIComponent(fileName || 'file')}`);
      if (res.ok) {
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
    } catch {
      // Fallback to inline base64 below
    }
  }

  if (base64) {
    return base64ToBlobUrl(base64, mimeType || 'application/octet-stream');
  }

  throw new Error('File content is unavailable.');
}

export async function downloadUrlOrBase64File(
  url?: string,
  base64?: string,
  mimeType?: string,
  fileName?: string
): Promise<void> {
  const objectUrl = await resolveUrlOrBase64Blob(url, base64, mimeType, fileName);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

export async function resolveStreamOrBlobUrl(
  url?: string,
  base64?: string,
  mimeType?: string,
  fileName?: string
): Promise<{ src: string; revokeOnClose: boolean }> {
  if (url && mimeType?.startsWith('video/')) {
    try {
      const headRes = await fetch(url, { method: 'HEAD' });
      if (headRes.ok) {
        return { src: url, revokeOnClose: false };
      }
    } catch {
      // Fallback to blob resolution
    }
  }
  const blobUrl = await resolveUrlOrBase64Blob(url, base64, mimeType, fileName);
  return { src: blobUrl, revokeOnClose: true };
}

async function computeSha256Hex(raw: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export async function getEmailBlockKey(email: string): Promise<string> {
  const hex = await computeSha256Hex(email.trim().toLowerCase());
  return `em_${hex.slice(0, 32)}`;
}

export function getOrCreateDeviceToken(): string {
  const storageKey = 'biranu_device_token';
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing && /^[a-zA-Z0-9_-]{20,64}$/.test(existing)) {
      return existing;
    }
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let token = '';
    for (let i = 0; i < bytes.length; i += 1) {
      token += chars[bytes[i] % chars.length];
    }
    localStorage.setItem(storageKey, token);
    return token;
  } catch {
    return 'fallback_device_token_00000001';
  }
}

export async function getDeviceBlockKey(): Promise<string> {
  const hex = await computeSha256Hex(getOrCreateDeviceToken());
  return `dv_${hex.slice(0, 32)}`;
}

export async function safeReadJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(
      res.ok
        ? 'Invalid JSON response from server.'
        : clean.slice(0, 180) || `Server error (${res.status})`
    );
  }
}

export async function checkIfBlocked(keys: Array<string | undefined | null>): Promise<boolean> {
  const cleanKeys = keys.filter((k): k is string => Boolean(k && k.length >= 10));
  if (cleanKeys.length === 0) return false;
  try {
    const res = await fetch('/api/blocked/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: cleanKeys }),
    });
    if (!res.ok) return false;
    const data = await safeReadJson<{ blocked?: boolean }>(res);
    return Boolean(data.blocked);
  } catch {
    return false;
  }
}
