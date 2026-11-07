import type { Config } from './types';
import { getYear } from 'date-fns';
import { url } from '@/utils/url';

const config: Config = {
  title: '团子',
  description: '大河の一滴。',
  author: '团子',
  favicon: url('favicon-white-mochi.png'),
  navbar: {
    logo: import('@/custom/NavLogo.astro'),
    menu: [
      {
        label: '首页',
        url: url('/'),
        icon: 'tabler:home'
      },
      {
        label: '标签',
        url: url('/tags'),
        icon: 'tabler:tag'
      },
      {
        label: '分类',
        url: url('/categories'),
        icon: 'tabler:category'
      },
      {
        label: '归档',
        url: url('/archive'),
        icon: 'tabler:archive'
      },
      {
        label: '友链',
        url: url('/friends'),
        icon: 'tabler:heart-handshake'
      },
      {
        label: '关于',
        url: url('/about'),
        icon: 'tabler:info-circle'
      },
    ],
    hasSearchToggle: true,
    hasThemeToggle: true,
  },
  hero: {
    background: import('src/assets/hero-bg.jpg'),
    description: '相逢即是缘，欢迎来到 团子のUtopia，我是团子。 这里是一处电波发射器。只为寻觅与我同频之人，希望填补我那冷清的世界。',
    title: import('@/custom/HeroLogo.astro'),
  },
  sidebar: {
    widgets: [
      {
        name: 'profile',
        author: '团子',
        description: '大河の一滴。',
        avatar: import('src/assets/avatar-sakura.webp'),
        background: import('src/assets/profile-bg.png'),
        socialIcons: [
          {
            label: 'github',
            color: '#7c8690',
            icon: 'tabler:brand-github',
            url: 'https://github.com/likalikali'
          },
          {
            label: 'bilibili',
            color: '#fc87b2',
            icon: 'tabler:brand-bilibili',
            url: 'https://space.bilibili.com/13655166'
          },
          {
            label: 'netease music',
            color: '#ff4e6a',
            icon: 'tabler:brand-netease-music',
            url: 'https://music.163.com/user/562918722'
          },
          {
            label: 'mail',
            color: '#7562c7',
            icon: 'tabler:mail',
            url: 'mailto:likafeaturingnino@163.com'
          }
        ],
      },
      {
        name: 'tag-cloud',
        sortBy: 'count',
        order: 'desc',
        limit: 30,
      },
      {
        name: 'category-tree',
        sortBy: 'count',
        order: 'desc',
        expandDepth: 2,
      },
    ]
  },
  pagination: {
    pageSize: 20,
    hasControls: true,
    hasEdges: false,
    siblings: 2,
    boundaries: 1,
  },
  article: {
    outdateTip: {
      outdateLimit: 180,
    },
    license: {
      licenseName: 'CC BY-NC-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh',
      infoText: '转载或引用本文时请注明作者及出处，不得用于商业用途。',
    }
  },
  // 评论保存到本站仓库的 GitHub Discussions。
  comment: {
    provider: 'giscus',
    options: {
      repo: 'likalikali/astro-mecure',
      repoId: 'R_kgDOSpW-bw',
      category: 'Announcements',
      categoryId: 'DIC_kwDOSpW-b84DKbqg',
      mapping: 'pathname',
      strict: '1',
      reactionsEnabled: '1',
      emitMetadata: '0',
      inputPosition: 'top',
      lang: 'zh-CN',
    },
  },
  footer: {
    links: [
      { label: '更新日志', url: url('changelog')},
      { label: '引用声明', url: url('reference')},
      { label: '关于', url: url('about')},
      { label: '归档', url: url('archive')},
      { label: '友情链接', url: url('friends')},
      { label: 'Github', url: 'https://github.com/likalikali'},
    ],
    declarations: [
      `Copyright © ${getYear(new Date())} 团子 All Rights Reserved.`,
    ],
    generator: false,
    rss: true,
    sitemap: true,
  },
}

export default config;
