import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
const password=randomBytes(24).toString('base64url');
const salt=randomBytes(16).toString('hex');
const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
const secret=randomBytes(48).toString('base64url');
fs.writeFileSync('.env.admin.local',`BLOG_ADMIN_PASSWORD_HASH=${hash}\nBLOG_SESSION_SECRET=${secret}\n`,{flag:'wx',mode:0o600});
fs.writeFileSync('admin-credentials.local.txt',`管理入口：https://blog.anriri.pp.ua/admin/\n管理员密码：${password}\n\n请保存到密码管理器。这个文件不会提交到 GitHub。\n`,{flag:'wx',mode:0o600});
console.log('已生成本地管理员凭据；未输出密码，也不会提交到 GitHub。');
