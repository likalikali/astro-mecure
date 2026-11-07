import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PAGES, allowedPath } from './cloud-admin-core.js';
import { databaseRequest, saveDocument } from './content-database.js';
const files = execFileSync('git',['ls-files','src/content/blog'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(allowedPath);
const existing = await databaseRequest('?select=path');
const paths = new Set(existing.map(d=>d.path));
let inserted=0;
for(const path of [...files,...PAGES]) {
  if(paths.has(path)) continue; // Never overwrite later online edits on a repeated import.
  const source=await fs.readFile(path,'utf8').catch(()=>fs.readFile('content-backup/'+path.replace(/^src\//,''),'utf8'));
  await saveDocument(path,source);inserted++;
}
console.log(`Inserted ${inserted}; preserved ${existing.length} existing records.`);
