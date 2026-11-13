import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const PUBLIC_FILES=[
 '.gitignore','.github/workflows/documentation.yml','CONTRIBUTING.md','documentation.json','README.md','package.json','wrangler.jsonc','openapi.json','reference.json',
 'assets/icon.png','assets/orchesphere.png',
 'examples/api-client.mjs','examples/oauth-client.mjs','examples/oauth.mjs','examples/read-workspaces.py',
 'scripts/check-docs.mjs','scripts/build.mjs','scripts/check-public.mjs','scripts/preview.mjs',
 'src/analytics.mjs','src/catalog-pages.mjs','src/content.mjs','src/reference-pages.mjs','src/site.css','src/site.js','src/worker-core.mjs','src/worker.mjs',
 'tests/analytics.test.mjs','tests/oauth-example.test.mjs','tests/reference-docs.test.mjs','tests/worker.test.mjs','tests/public-build.test.mjs',
];
const ignored=new Set(['.git','dist','node_modules','.wrangler','src/generated.mjs']);
export async function inspectPublicTree(root){
 const allowed=new Set(PUBLIC_FILES),found=[];
 async function walk(directory,prefix=''){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const relative=prefix+entry.name;if(ignored.has(relative))continue;if(entry.isSymbolicLink())throw Error('Symlink is not publishable: '+relative);if(entry.isDirectory()){await walk(path.join(directory,entry.name),relative+'/');continue;}if(!allowed.has(relative))throw Error('Unexpected public file: '+relative);const bytes=await fs.readFile(path.join(directory,entry.name));if(!relative.endsWith('.png')){const content=bytes.toString('utf8');if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[A-Z0-9]{16}|\bsk_live_[A-Za-z0-9]{12,}|\bgh[pousr]_[A-Za-z0-9]{20,}/.test(content))throw Error('Credential pattern in public file: '+relative);if(/C:\\Users\\|\/Users\/[^/]+\/|\b\d{12}\.dkr\.ecr\./.test(content))throw Error('Private host provenance in public file: '+relative);}found.push({path:relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}
 await walk(root);for(const file of PUBLIC_FILES)if(!found.some(item=>item.path===file))throw Error('Missing public file: '+file);return found.sort((a,b)=>a.path.localeCompare(b.path));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const files=await inspectPublicTree(fileURLToPath(new URL('../',import.meta.url)));console.log(JSON.stringify({files,count:files.length},null,2));}
