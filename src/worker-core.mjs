const PUBLIC_ORIGIN='https://api.orchesphere.ai';
const BACKEND='https://orchesphere.ai/api/developer';
const MAX_BODY_BYTES=24000;
const privateHeaders={'cache-control':'private, no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'};
const error=(status,code,message,headers={})=>Response.json({error:{code,message}},{status,headers:{...privateHeaders,...headers}});
const denied=()=>error(404,'not_found','This route is not available.');
const patterns={workspaceId:'[A-Za-z0-9_-]{8,80}',taskId:'[A-Za-z0-9_-]{8,80}',jobId:'[A-Za-z0-9_-]{8,80}',connectionId:'[A-Za-z0-9_-]{8,80}',provider:'[a-z0-9][a-z0-9-]{1,63}',environment:'(?:production|sandbox|\\*)'};
function routePattern(path){return new RegExp('^'+path.split('/').map(part=>{const parameter=/^\{([A-Za-z]+)\}$/.exec(part);if(parameter){if(!patterns[parameter[1]])throw Error('Unsupported route parameter.');if(parameter[1]==='environment'&&!path.includes('/service-permissions/'))return '(?:production|sandbox)';return patterns[parameter[1]];}return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('/')+'$');}
async function boundedBody(request){
 if(request.headers.has('content-encoding')&&request.headers.get('content-encoding')!=='identity')throw 415;
 const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY_BYTES))throw 413;
 if(!request.body)return undefined;
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY_BYTES){await reader.cancel();throw 413;}chunks.push(value);}}finally{reader.releaseLock();}
 if(!size)return undefined;
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get('content-type')||''))throw 415;
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}return body;
}
const publicSecurity={
 'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY','strict-transport-security':'max-age=31536000',
 'permissions-policy':'camera=(), microphone=(), geolocation=()',
 'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; upgrade-insecure-requests",
};
export function createWorker({routes,publicPaths,apiEnabled=false,fetcher=fetch}){
 const admitted=routes.map(route=>({...route,pattern:routePattern(route.path)}));
 async function forward(request,path,{discovery=false}={}){
  const headers=new Headers({accept:'application/json'});
  if(!discovery){for(const name of ['authorization','idempotency-key'])if(request.headers.has(name)){const value=request.headers.get(name);if(value.length>(name==='authorization'?20000:100))return error(400,'invalid_header','A request header exceeds the supported limit.');headers.set(name,value);}}
  let body;try{body=discovery?undefined:await boundedBody(request);}catch(status){return error(status===415?415:413,status===415?'unsupported_media_type':'request_too_large',status===415?'Send a JSON request body.':'The request body exceeds 24000 bytes.');}
  if(body)headers.set('content-type','application/json');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  const recovery=['GET','HEAD'].includes(request.method)?'Retry later.':'Read the current state and reconcile the result before repeating this request.';
  try{
   const response=await fetcher(BACKEND+path,{method:discovery?'GET':request.method,headers,body,redirect:'manual',cache:'no-store',signal:controller.signal});
   if(response.status>=300&&response.status<400||response.status!==204&&!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();return error(502,'upstream_response_invalid','The API returned an unexpected response. '+recovery);}
   const outgoing=new Headers({...privateHeaders,'cache-control':discovery?'no-store':'private, no-store'});
   for(const name of ['content-type','www-authenticate','retry-after','allow'])if(response.headers.has(name))outgoing.set(name,response.headers.get(name));
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:outgoing});
  }catch{return error(503,'temporarily_unavailable','The API is temporarily unavailable. '+recovery);}finally{clearTimeout(timer);}
 }
 return {async fetch(request,env){
  const url=new URL(request.url);if(url.origin!==PUBLIC_ORIGIN)return denied();
  const path=url.pathname;
  const discovery=path==='/.well-known/oauth-protected-resource';
  if((path==='/v1'||path.startsWith('/v1/')||discovery)&&apiEnabled!==true)return error(503,'api_not_ready','The API release is pending. See the documentation for current availability.');
  if(path.includes('%')||path.includes('\\'))return error(400,'invalid_path','Use the documented path without encoded components.');
  if(path==='/v1'||path.startsWith('/v1/')||discovery){
   if(url.search)return error(400,'unsupported_query','Query parameters are not supported on this endpoint.');
   if(request.headers.has('origin')&&request.headers.get('origin')!==PUBLIC_ORIGIN)return error(403,'origin_not_permitted','Use a backend or native client for API access.');
   const matches=discovery?[{method:'GET'},{method:'HEAD'}]:admitted.filter(route=>route.pattern.test(path));
   if(!matches.length)return denied();
   if(!matches.some(route=>route.method===request.method))return error(405,'method_not_allowed','Use the documented HTTP method.',{allow:matches.map(route=>route.method).join(', ')});
   return forward(request,discovery?'/resource':path,{discovery});
  }
  if(!['GET','HEAD'].includes(request.method))return error(405,'method_not_allowed','Public documentation supports GET and HEAD.',{allow:'GET, HEAD'});
  const target=publicPaths[path];if(!target)return denied();
  try{
   const asset=await env.ASSETS.fetch(new Request(PUBLIC_ORIGIN+target,{method:request.method}));
   if(asset.status!==200)return denied();
   const headers=new Headers(publicSecurity);for(const key of ['content-type','etag'])if(asset.headers.has(key))headers.set(key,asset.headers.get(key));
   headers.set('cache-control',/-[a-f0-9]{12}\./.test(target)?'public, max-age=31536000, immutable':'public, max-age=300');
   return new Response(request.method==='HEAD'?null:asset.body,{status:200,headers});
  }catch{return error(503,'documentation_unavailable','Documentation is temporarily unavailable. Retry later.');}
 }};
}
