import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import type { ProtectedContentPayload } from '@/types';

export const PROTECTED_POST_EXCERPT = '这篇文章需要密码访问。';
export const PROTECTED_POST_RAW = '<p>这篇文章需要密码访问。</p>';

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ITERATIONS = 120000;

function toBase64(value: Buffer) {
  return value.toString('base64');
}

export function encryptProtectedContent(
  content: string,
  password: string
): ProtectedContentPayload {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(content, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return {
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}
