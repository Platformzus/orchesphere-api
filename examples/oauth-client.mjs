// Runnable native-client example. No credential is printed or written to disk.
import http from 'node:http';
import {PendingAuthorization,InvalidCallbackError,REST_RESOURCE,exchangeCode,refreshTokens,revokeToken} from './oauth.mjs';
import {readWorkspaces} from './api-client.mjs';
const clientId=process.env.ORCH_CLIENT_ID,redirectUri='http://127.0.0.1:8788/callback';
const pending=new PendingAuthorization(),start=pending.begin({clientId,redirectUri});
let server,timer,tokens;
try{
 const callback=new Promise((resolve,reject)=>{
  server=http.createServer((request,response)=>{
   response.setHeader('content-type','text/plain; charset=utf-8');response.setHeader('cache-control','no-store');response.setHeader('referrer-policy','no-referrer');
   if(request.method!=='GET'||request.headers.host!=='127.0.0.1:8788'||!request.url?.startsWith('/callback?')){response.writeHead(404);response.end('Not found.');return;}
   try{const result=pending.accept(new URL(request.url,redirectUri).href);response.end('Authorization received. Return to your terminal.');resolve(result);}catch(error){response.writeHead(400);response.end('Authorization could not be confirmed. Return to your terminal.');if(!(error instanceof InvalidCallbackError))reject(error);}
  });
  server.on('error',()=>reject(Error('The registered loopback port is unavailable. Use the exact registered redirect port.')));
  server.listen(8788,'127.0.0.1',()=>console.log('Open this authorization URL in your browser:\n'+start.url));
  timer=setTimeout(()=>reject(Error('Authorization timed out. Start the example again.')),600000);
 });
 const exchange=await callback;clearTimeout(timer);server.close();
 tokens=await exchangeCode(exchange);let result=await readWorkspaces(tokens.accessToken);console.log('Authorized. Received '+result.workspaces.length+' workspaces.');
 if(tokens.refreshToken){tokens=await refreshTokens({clientId,resource:REST_RESOURCE,refreshToken:tokens.refreshToken});result=await readWorkspaces(tokens.accessToken);console.log('Refresh succeeded. Received '+result.workspaces.length+' workspaces.');}
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
 clearTimeout(timer);server?.close();
 if(tokens){try{await revokeToken({clientId,token:tokens.refreshToken||tokens.accessToken,hint:tokens.refreshToken?'refresh_token':'access_token'});console.log('Example grant revoked.');}catch{console.error('Revocation could not be confirmed. Disconnect this client in OrcheSphere.');process.exitCode=1;}tokens=null;}
}
