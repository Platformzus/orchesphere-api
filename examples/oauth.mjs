import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
export const ISSUER='https://orchesphere.ai',REST_RESOURCE='https://api.orchesphere.ai';
const resources=new Set([REST_RESOURCE,ISSUER+'/mcp']);
const equal=(left,right)=>{const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);};
export class InvalidCallbackError extends Error {}
export class PendingAuthorization {
 #pending=null;#now;
 constructor({now=Date.now}={}){this.#now=now;}
 begin({clientId,redirectUri,resource=REST_RESOURCE,scopes=['orchesphere.read','offline_access']}){
  if(!/^orch_app_[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(clientId))throw Error('Use your registered application client ID.');
  if(typeof redirectUri!=='string'||redirectUri.length>2048||/[\s\\]/.test(redirectUri)||!/^https:\/\//.test(redirectUri)&&!/^http:\/\/(?:127\.0\.0\.1|\[::1\])(?::\d{1,5})?\//.test(redirectUri))throw Error('Use an exact HTTPS or literal-loopback redirect URI.');
  const redirect=new URL(redirectUri);if(redirect.username||redirect.password||redirect.hash||redirect.search||redirect.protocol!=='https:'&&!(redirect.protocol==='http:'&&['127.0.0.1','[::1]'].includes(redirect.hostname)))throw Error('Use an exact HTTPS or literal-loopback redirect URI without query or fragment.');
  if(!resources.has(resource)||!scopes.includes('orchesphere.read')||scopes.some(scope=>!['orchesphere.read','orchesphere.jobs','orchesphere.manage','offline_access'].includes(scope)))throw Error('Choose a supported resource and registered scopes.');
  const verifier=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
  this.#pending={clientId,redirectUri,resource,verifier,state,expires:this.#now()+600000};
  const url=new URL(ISSUER+'/oauth/authorize');url.search=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirectUri,resource,scope:[...new Set(scopes)].join(' '),state,code_challenge:challenge,code_challenge_method:'S256'});
  return {url:url.href,state};
 }
 accept(callbackUrl){
  const pending=this.#pending;if(!pending||pending.expires<=this.#now()){this.#pending=null;throw Error('The pending authorization expired or was already used.');}
  if(typeof callbackUrl!=='string'||callbackUrl.length>12000||/[\s\\]/.test(callbackUrl)||!callbackUrl.startsWith(pending.redirectUri+'?'))throw new InvalidCallbackError('Invalid callback.');
  let url;try{url=new URL(callbackUrl);}catch{throw new InvalidCallbackError('Invalid callback.');}const expected=new URL(pending.redirectUri),p=url.searchParams;
  if(url.origin!==expected.origin||url.pathname!==expected.pathname||url.hash||url.username||url.password||[...p.keys()].some(key=>p.getAll(key).length!==1||!['state','code','iss','error','error_description','error_uri'].includes(key))||!equal(p.get('state')||'',pending.state)||p.get('iss')!==ISSUER)throw new InvalidCallbackError('The callback URI, state or issuer does not match the pending authorization.');
  this.#pending=null;
  if(p.has('error'))throw Error('Authorization was declined or denied. Start again if needed.');
  const code=p.get('code');if(!code||code.length>4096)throw Error('The callback did not include a valid authorization code.');
  return {clientId:pending.clientId,redirectUri:pending.redirectUri,resource:pending.resource,verifier:pending.verifier,code};
 }
}
async function postForm(path,fields,{fetcher=fetch}={}){
 let response;try{response=await fetcher(ISSUER+path,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body:new URLSearchParams(fields).toString(),redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('The OAuth request could not complete. Do not automatically repeat a code exchange or refresh.');}
 if(!response.ok)throw Error('OAuth request failed (HTTP '+response.status+'). Restart authorization when required.');
 return response;
}
async function tokenResult(response){
 const reader=response.body?.getReader();if(!reader)throw Error('The OAuth response is incomplete.');let total=0;const chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>24000){await reader.cancel();throw Error('The OAuth response exceeds the expected bound.');}chunks.push(value);}
 let result;try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('The OAuth response is not valid JSON.');}
 if(typeof result.access_token!=='string'||result.access_token.length<16||result.access_token.length>20000||String(result.token_type).toLowerCase()!=='bearer'||!Number.isFinite(result.expires_in)||result.expires_in<=0||result.expires_in>3600||result.refresh_token!==undefined&&typeof result.refresh_token!=='string')throw Error('The OAuth response has an unexpected token shape.');
 return {accessToken:result.access_token,refreshToken:result.refresh_token||null,expiresIn:result.expires_in,scope:result.scope||''};
}
export async function exchangeCode({clientId,redirectUri,resource,code,verifier},options){return tokenResult(await postForm('/oauth/token',{grant_type:'authorization_code',client_id:clientId,redirect_uri:redirectUri,resource,code,code_verifier:verifier},options));}
export async function refreshTokens({clientId,resource,refreshToken},options){return tokenResult(await postForm('/oauth/token',{grant_type:'refresh_token',client_id:clientId,resource,refresh_token:refreshToken},options));}
export async function revokeToken({clientId,token,hint='refresh_token'},options){await postForm('/oauth/revoke',{client_id:clientId,token,token_type_hint:hint},options);}
