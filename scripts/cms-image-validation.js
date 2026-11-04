import path from 'node:path';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXTENSIONS = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);

function hasPrefix(bytes, signature) {
  return bytes.subarray(0, signature.length).equals(Buffer.from(signature));
}

export function detectImageMime(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (bytes.length >= 24 && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (bytes.length >= 4 && hasPrefix(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'image/gif';
  if (bytes.length >= 16 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * The local CMS allows ordinary images only, never SVG/AVIF/HTML.
 * Check filename, declared MIME, and file signature as separate layers.
 * This is input validation, not a replacement for timely Sharp upgrades.
 */
export function validateCmsImage({ filename, mime, bytes }) {
  const normalized = String(filename || 'image.png').replace(/\\/g, '/');
  const safeFilename = path.posix.basename(normalized)
    .replace(/[^\p{L}\p{N}._-]/gu, '-');
  const extension = path.extname(safeFilename).toLowerCase();
  const expectedMime = EXTENSIONS.get(extension);

  if (!expectedMime || safeFilename.length > 120 || safeFilename.startsWith('.') || safeFilename === '..') {
    throw new Error('不支持的文件名或图片扩展名');
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error('图片大小必须在 0–8MB 之间');
  }
  const actualMime = detectImageMime(bytes);
  if (actualMime !== expectedMime || String(mime).toLowerCase() !== expectedMime) {
    throw new Error('图片文件格式与扩展名或 MIME 类型不一致');
  }
  return { filename: safeFilename, mime: actualMime };
}
