import { defineMiddleware } from 'astro:middleware';
import { contentScope } from '../scripts/content-database.js';
export const onRequest = defineMiddleware(async (_context, next) => contentScope.run({}, async () => {
  const response = await next();
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('CDN-Cache-Control', 'no-store');
  response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return response;
}));
