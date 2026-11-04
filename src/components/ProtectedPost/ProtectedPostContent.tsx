import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { ProtectedContentPayload } from '@/types';

export interface ProtectedPostContentProps {
  slug: string;
  title: string;
  hint?: string;
  encryptedContent: ProtectedContentPayload;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function decodeBase64(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function decryptContent(
  payload: ProtectedContentPayload,
  password: string
) {
  if (!window.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable.');
  }

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: decodeBase64(payload.salt),
      iterations: payload.iterations,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const plain = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64(payload.iv),
    },
    key,
    decodeBase64(payload.ciphertext)
  );
  return decoder.decode(plain);
}

function readCachedContent(key: string) {
  try {
    return window.sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeCachedContent(key: string, content: string) {
  try {
    window.sessionStorage.setItem(key, content);
  } catch {
    // sessionStorage 只是体验增强，失败不影响解锁阅读。
  }
}

export default function ProtectedPostContent({
  slug,
  title,
  hint,
  encryptedContent,
}: ProtectedPostContentProps) {
  const storageKey = useMemo(() => `protected-post:${slug}`, [slug]);
  const [password, setPassword] = useState('');
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    setHtml(readCachedContent(storageKey));
  }, [storageKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setError('请输入访问密码。');
      return;
    }

    setIsUnlocking(true);
    setError('');
    try {
      const decrypted = await decryptContent(encryptedContent, password);
      setHtml(decrypted);
      writeCachedContent(storageKey, decrypted);
      setPassword('');
    } catch {
      setError('密码不正确，或当前浏览器不支持安全解密。');
    } finally {
      setIsUnlocking(false);
    }
  }

  if (html) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <section className="not-prose rounded-xl border border-blue-200/70 bg-blue-50/80 p-5 text-gray-800 shadow-sm dark:border-blue-400/20 dark:bg-blue-950/30 dark:text-gray-100">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">需要访问密码</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          《{title}》已设置访问权限，请输入密码查看正文。
        </p>
        {hint && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            提示：{hint}
          </p>
        )}
      </div>
      <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={`post-password-${slug}`}>
          访问密码
        </label>
        <input
          id={`post-password-${slug}`}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          placeholder="访问密码"
        />
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400"
          type="submit"
          disabled={isUnlocking}
        >
          {isUnlocking ? '解锁中...' : '解锁'}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
