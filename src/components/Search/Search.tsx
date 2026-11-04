import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtom } from 'jotai';
import { searchModelOpen as searchOpenAtom } from '@/store/atoms';
import { url } from '@/utils/url';

interface SearchEntry {
  title: string;
  description: string;
  category: string;
  tags: string[];
  url: string;
}

export default function Search() {
  const [open, setOpen] = useAtom(searchOpenAtom);
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<SearchEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(current => !current);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const controller = new AbortController();
    setStatus('loading');
    fetch(url('search-index.json'), { signal: controller.signal, credentials: 'same-origin' })
      .then(response => {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json() as Promise<SearchEntry[]>;
      })
      .then(data => {
        if (!controller.signal.aborted) {
          setPosts(Array.isArray(data) ? data : []);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [open]);

  const results = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return posts.slice(0, 10);
    return posts.filter(post => {
      const text = [post.title, post.description, post.category, ...post.tags]
        .join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    }).slice(0, 40);
  }, [posts, query]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 px-3 pt-[10vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="search-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900 dark:text-gray-100"
        onClick={event => event.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 id="search-title" className="sr-only">搜索博客文章</h2>
          <label htmlFor="search-input" className="sr-only">搜索关键词</label>
          <input ref={inputRef} id="search-input" type="search" value={query}
            onChange={event => setQuery(event.target.value)} placeholder="搜索文章标题、摘要或标签…"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-900 outline-none focus:ring-2 focus:ring-pink-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
          <button type="button" onClick={() => setOpen(false)} aria-label="关闭搜索"
            className="rounded-lg px-2 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">关闭</button>
        </header>
        <div className="max-h-[65vh] min-h-32 overflow-y-auto p-3" aria-live="polite">
          {status === 'loading' && <p className="p-4 text-center text-gray-500">正在加载文章索引…</p>}
          {status === 'error' && <p className="p-4 text-center text-red-500">搜索索引加载失败，请刷新页面重试。</p>}
          {status === 'ready' && results.length === 0 && <p className="p-4 text-center text-gray-500">没有找到匹配的文章。</p>}
          {status === 'ready' && results.map(post => (
            <a key={post.url} href={post.url}
              className="block rounded-xl px-4 py-3 hover:bg-pink-50 focus:bg-pink-50 focus:outline-none dark:hover:bg-gray-800"
              onClick={() => setOpen(false)}>
              <div className="font-semibold">{post.title}</div>
              {post.description && <div className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{post.description}</div>}
              <div className="mt-1 text-xs text-pink-600 dark:text-pink-300">{[post.category, ...post.tags].filter(Boolean).join(' · ')}</div>
            </a>
          ))}
          {status === 'ready' && !query.trim() && <p className="p-4 text-xs text-gray-400">Ctrl / ⌘ + K 可打开搜索</p>}
        </div>
      </section>
    </div>,
    document.body,
  );
}
