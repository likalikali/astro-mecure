// Astro 4's compatible adapter predates Node 22 and otherwise emits retired Node 18.
// Keep the generated function runtime aligned with the project's tested Node major.
import fs from 'node:fs';
import path from 'node:path';
const root='.vercel/output/functions';
function visit(dir) {
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())visit(file);
  else if(entry.name==='.vc-config.json') {
   const config=JSON.parse(fs.readFileSync(file,'utf8'));
   if(config.runtime?.startsWith('nodejs')) {
    config.runtime='nodejs22.x';fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');
   }
  }
 }
}
if(!fs.existsSync(root))throw Error('Missing Vercel function output');
visit(root);console.log('Vercel Node functions target Node 22.');
