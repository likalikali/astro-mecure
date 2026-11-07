import type { APIRoute } from 'astro';
import handler from '../../../scripts/cloud-admin-handler.js';
export const ALL: APIRoute = async ({ request }) => {
  const headers = new Headers(); let status = 200, body = '';
  const response = {
    setHeader(key: string, value: string) { headers.set(key,value); },
    set statusCode(value: number) { status=value; },
    end(value: string) { body=value; },
  };
  // Cap the body before JSON parsing; Vercel also enforces its platform limit.
  let input;
  if(request.method==='POST') {
    const text = await request.text();
    if(Buffer.byteLength(text)>600_000) return new Response(JSON.stringify({error:'内容过大'}),{status:413});
    try { input=JSON.parse(text); } catch { return new Response(JSON.stringify({error:'请求格式不正确'}),{status:400}); }
  }
  await handler({ method:request.method,url:request.url,headers:Object.fromEntries(request.headers),body:input },response);
  return new Response(body,{status,headers});
};
