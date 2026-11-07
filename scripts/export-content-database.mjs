import fs from 'node:fs/promises';
import { databaseRequest } from './content-database.js';
const records=[];
for(let offset=0;;offset+=500){const page=await databaseRequest(`?order=path&limit=500&offset=${offset}`);records.push(...page);if(page.length<500)break;}
const dir='_drafts/database-backups';await fs.mkdir(dir,{recursive:true});
const file=dir+'/'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
await fs.writeFile(file,JSON.stringify({exportedAt:new Date().toISOString(),documents:records},null,2),{mode:0o600});
console.log(`Exported ${records.length} records to ${file}`);
