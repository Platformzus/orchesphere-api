export async function readWorkspaces(accessToken,{fetcher=fetch}={}){
 if(typeof accessToken!=='string'||!accessToken||accessToken.length>20000||/[\r\n]/.test(accessToken))throw Error('Supply a valid access token through your protected application environment.');
 let response;try{response=await fetcher('https://api.orchesphere.ai/v1/workspaces',{headers:{authorization:'Bearer '+accessToken,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('The workspace request could not complete.');}
 if(!response.ok)throw Error('Workspace request failed (HTTP '+response.status+'). Check the grant and current company permissions.');
 const reader=response.body.getReader(),chunks=[];let total=0;for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>1048576){await reader.cancel();throw Error('The workspace response is too large.');}chunks.push(value);}
 let result;try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('The workspace response is not valid JSON.');}
 if(!Array.isArray(result.workspaces)||!result.page)throw Error('Unexpected workspace response.');return result;
}
