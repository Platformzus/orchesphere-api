import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectPublicTree,PUBLIC_FILES} from '../scripts/check-public.mjs';
import {createWorker} from '../src/worker-core.mjs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('the publication inventory is explicit and includes only reviewed files',async()=>{const files=await inspectPublicTree(root);assert.equal(files.length,PUBLIC_FILES.length);assert.ok(files.every(file=>file.sha256.length===64));});
test('an unexpected credential file is rejected before publication',async()=>{const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'orchesphere-public-test-'));try{await fs.writeFile(path.join(temporary,'.env'),'synthetic fixture only');await assert.rejects(inspectPublicTree(temporary),/Unexpected public file/);}finally{await fs.rm(temporary,{recursive:true,force:true});}});
test('standalone clone metadata is excluded from the publication inventory',async()=>{const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'orchesphere-public-clone-'));try{for(const file of PUBLIC_FILES){await fs.mkdir(path.dirname(path.join(temporary,file)),{recursive:true});await fs.writeFile(path.join(temporary,file),'fixture');}await fs.mkdir(path.join(temporary,'.git'));await fs.writeFile(path.join(temporary,'.git','config'),'synthetic clone metadata');const files=await inspectPublicTree(temporary);assert.equal(files.length,PUBLIC_FILES.length);assert.ok(files.every(file=>!file.path.startsWith('.git/')));}finally{await fs.rm(temporary,{recursive:true,force:true});}});
test('every contract route forwards only its declared method and fixed path',async()=>{const reference=JSON.parse(await fs.readFile(path.join(root,'reference.json'),'utf8')),calls=[],worker=createWorker({apiEnabled:true,routes:reference.rest.operations,publicPaths:{},fetcher:async(url,init)=>{calls.push({url,init});return Response.json({ok:true});}});for(const operation of reference.rest.operations){const route=operation.path.replace(/\{(?:workspaceId|taskId|jobId|connectionId|operationId)\}/g,'example_record_001').replace('{provider}','stripe').replace('{environment}','production');const response=await worker.fetch(new Request('https://api.orchesphere.ai'+route,{method:operation.method}),{});assert.equal(response.status,200,operation.operationId);assert.equal(calls.at(-1).url,'https://orchesphere.ai/api/developer'+route);assert.equal(calls.at(-1).init.method,operation.method);}assert.equal(calls.length,reference.rest.operations.length);});
test('generated production Worker derives API admission from the documentation release status',async()=>{
 for(const pending of [true,false]){
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'orchesphere-public-gate-'));
  assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir())+path.sep+'orchesphere-public-gate-'));
  try{
   for(const file of PUBLIC_FILES){await fs.mkdir(path.dirname(path.join(temporary,file)),{recursive:true});await fs.copyFile(path.join(root,file),path.join(temporary,file));}
   const content=path.join(temporary,'src/content.mjs'),text=await fs.readFile(content,'utf8');assert.match(text,/export const RELEASE_PENDING=(?:true|false);/);
   await fs.writeFile(content,text.replace(/export const RELEASE_PENDING=(?:true|false);/,'export const RELEASE_PENDING='+pending+';'));
   execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temporary,stdio:'pipe',windowsHide:true});
   const generated=await import(pathToFileURL(path.join(temporary,'src/generated.mjs')).href);assert.equal(generated.apiEnabled,!pending);
   let calls=0;const previous=globalThis.fetch;let worker;
   try{globalThis.fetch=async()=>{calls++;return Response.json({ok:true});};worker=(await import(pathToFileURL(path.join(temporary,'src/worker.mjs')).href)).default;}finally{globalThis.fetch=previous;}
   const env={ASSETS:{fetch:async()=>new Response('Documentation',{headers:{'content-type':'text/html'}})}};
   for(const route of ['/v1/workspaces','/.well-known/oauth-protected-resource']){const response=await worker.fetch(new Request('https://api.orchesphere.ai'+route),env);assert.equal(response.status,pending?503:200);if(pending)assert.equal((await response.json()).error.code,'api_not_ready');}
   assert.equal(calls,pending?0:2);assert.equal((await worker.fetch(new Request('https://api.orchesphere.ai/quickstart'),env)).status,200);
   const page=await fs.readFile(path.join(temporary,'dist/index.html'),'utf8');assert.equal(page.includes('<strong>Release pending.</strong>'),pending);
  }finally{await fs.rm(temporary,{recursive:true,force:true});}
 }
});
