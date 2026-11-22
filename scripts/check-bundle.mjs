import { readdir,readFile } from 'node:fs/promises';
import path from 'node:path';
const forbidden=[/sk-(?:proj-)?[A-Za-z0-9_-]{24,}/,/sb_secret_[A-Za-z0-9_-]{10,}/,/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,/Littleton High School/,/52\.31/,/muhit@/i];
let files=0;
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scan(file);else if(/\.(?:js|html|css|json|webmanifest)$/.test(file)){files++;const text=await readFile(file,'utf8');if(forbidden.some(pattern=>pattern.test(text)))throw new Error(`Potential secret or private plan data found in ${file}`);}}}
await scan('dist');console.log(`Checked ${files} static files: no known private-plan markers or secret patterns.`);
