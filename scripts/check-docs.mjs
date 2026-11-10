import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
export function validateExample(value,schema,schemas,location='example'){
 if(schema.$ref){const name=schema.$ref.split('/').at(-1);assert.ok(schemas[name],location+': missing schema '+name);schema={...schemas[name],...Object.fromEntries(Object.entries(schema).filter(([key])=>key!=='$ref'))};}
 if(schema.anyOf){assert.ok(schema.anyOf.some(candidate=>{try{validateExample(value,candidate,schemas,location);return true;}catch{return false;}}),location+': no matching union');return;}
 const types=Array.isArray(schema.type)?schema.type:[schema.type],actual=value===null?'null':Array.isArray(value)?'array':typeof value;
 assert.ok(!schema.type||types.includes(actual)||(Number.isInteger(value)&&types.includes('integer')),location+': invalid type');
 if(schema.enum)assert.ok(schema.enum.includes(value),location+': invalid enum');
 if(Object.hasOwn(schema,'const'))assert.deepEqual(value,schema.const,location+': invalid constant');
 if(schema.format==='email'&&typeof value==='string')assert.match(value,/^[^\s@]+@[^\s@]+\.[^\s@]+$/,location+': invalid email');
 if(typeof value==='string'){if(schema.minLength!==undefined)assert.ok(value.length>=schema.minLength,location+': too short');if(schema.maxLength!==undefined)assert.ok(value.length<=schema.maxLength,location+': too long');if(schema.pattern)assert.match(value,new RegExp(schema.pattern),location);if(schema.format==='uuid')assert.match(value,/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,location);if(schema.format==='date-time')assert.ok(Number.isFinite(Date.parse(value)),location+': invalid timestamp');}
 if(typeof value==='number'){if(schema.minimum!==undefined)assert.ok(value>=schema.minimum,location);if(schema.maximum!==undefined)assert.ok(value<=schema.maximum,location);}
 if(Array.isArray(value)){if(schema.minItems!==undefined)assert.ok(value.length>=schema.minItems,location);if(schema.maxItems!==undefined)assert.ok(value.length<=schema.maxItems,location);if(schema.uniqueItems)assert.equal(new Set(value.map(item=>JSON.stringify(item))).size,value.length,location+': duplicate items');value.forEach((item,index)=>schema.items&&validateExample(item,schema.items,schemas,location+'['+index+']'));}
 else if(value&&typeof value==='object'){if(schema.minProperties!==undefined)assert.ok(Object.keys(value).length>=schema.minProperties,location+': too few fields');if(schema.maxProperties!==undefined)assert.ok(Object.keys(value).length<=schema.maxProperties,location+': too many fields');for(const name of schema.required||[])assert.ok(Object.hasOwn(value,name),location+': missing '+name);for(const [name,item] of Object.entries(value)){if(schema.additionalProperties===false)assert.ok(Object.hasOwn(schema.properties||{},name),location+': unknown '+name);if(schema.properties?.[name])validateExample(item,schema.properties[name],schemas,location+'.'+name);}}
}
const nonempty=(value,label)=>assert.ok(typeof value==='string'&&value.trim().length>8,label+': needs a description');
function described(schema,label){for(const [name,field] of Object.entries(schema.properties||{})){nonempty(field.description,label+'.'+name);described(field,label+'.'+name);}if(schema.items)described(schema.items,label+'[]');for(const member of schema.anyOf||[])described(member,label);}
export function checkDocumentation(reference,openapi,documentation){
 for(const [name,value] of Object.entries({reference,openapi,documentation}))assert.doesNotMatch(JSON.stringify(value),/[\u00c2\u00c3]|\u00e2[\u20ac\u2020]/,name+': garbled Unicode');
 assert.match(documentation.version,/^\d{4}-\d{2}-\d{2}\.\d+$/);assert.match(documentation.reviewedAt,/^\d{4}-\d{2}-\d{2}$/);
 assert.equal(documentation.version.slice(0,10),documentation.reviewedAt,'Revision and review date differ');
 assert.deepEqual(reference.schemas,openapi.components.schemas,'Published response/request schemas differ');
 for(const [name,schema] of Object.entries(reference.schemas))described(schema,name);
 const contract=Object.entries(openapi.paths).flatMap(([route,methods])=>Object.entries(methods).map(([method,operation])=>[operation.operationId,method.toUpperCase(),route]));
 assert.deepEqual(contract.sort(),reference.rest.operations.map(op=>[op.operationId,op.method,op.path]).sort(),'REST inventory mismatch');
 for(const operation of reference.rest.operations){
  const definition=openapi.paths[operation.path][operation.method.toLowerCase()];
  for(const key of ['summary','description','permission','useWhen'])nonempty(operation[key],operation.operationId+'.'+key);
  assert.notEqual(operation.description,operation.permission,'Purpose duplicates permission: '+operation.operationId);
  for(const key of ['effects','retry','limitations']){assert.ok(Array.isArray(operation[key])&&operation[key].length,operation.operationId+'.'+key);operation[key].forEach(value=>nonempty(value,key));}
  assert.ok(definition.description.startsWith(operation.description),'Purpose differs: '+operation.operationId);
  const scopes=(definition.security||[]).flatMap(scheme=>Object.values(scheme).flat()).sort();assert.deepEqual(scopes,[...operation.scope].sort(),'Scope differs: '+operation.operationId);
  assert.ok(definition.responses['502'],'Gateway 502 missing: '+operation.operationId);
  const input=definition.requestBody?.content?.['application/json'],output=definition.responses[String(operation.status)]?.content?.['application/json'];
  assert.deepEqual(input?.schema||null,operation.requestSchema||null,operation.operationId+': request schema differs');
  if(input){assert.deepEqual(input.example,operation.exampleRequest,operation.operationId+': request example differs');assert.equal(definition.requestBody.required,operation.requestRequired,operation.operationId+': request requirement differs');}
  assert.ok(output,operation.operationId+': missing success status');assert.deepEqual(output.schema,operation.responseSchema,operation.operationId+': response schema differs');assert.deepEqual(output.example,operation.exampleResponse,operation.operationId+': response example differs');
  for(const parameter of definition.parameters||[])nonempty(parameter.description,operation.operationId+'.'+parameter.name);
  if(operation.requestSchema&&operation.exampleRequest!==null)validateExample(operation.exampleRequest,operation.requestSchema,reference.schemas,operation.operationId+'.request');
  validateExample(operation.exampleResponse,operation.responseSchema,reference.schemas,operation.operationId+'.response');
  for(const example of operation.responseExamples||[])validateExample(example.value,operation.responseSchema,reference.schemas,operation.operationId+'.'+example.title);
 }
 assert.deepEqual(Object.keys(documentation.mcp).sort(),reference.mcp.tools.map(tool=>tool.name).sort(),'MCP guidance inventory mismatch');
 for(const tool of reference.mcp.tools){const detail=documentation.mcp[tool.name];for(const key of ['title','purpose','useWhen','retry'])nonempty(detail[key],tool.name+'.'+key);for(const key of ['effects','limitations']){assert.ok(Array.isArray(detail[key])&&detail[key].length,tool.name+'.'+key);detail[key].forEach(value=>nonempty(value,key));}assert.ok(detail.exampleResult&&typeof detail.exampleResult==='object',tool.name+': missing result');validateExample(detail.exampleArguments,tool.inputSchema,reference.schemas,tool.name+'.arguments');}
 const protocolIds=new Set();for(const endpoint of documentation.protocol){assert.match(endpoint.id,/^[a-z][a-z0-9-]*$/);assert.ok(!protocolIds.has(endpoint.id),'Duplicate protocol section');protocolIds.add(endpoint.id);for(const key of ['title','purpose','authentication','input','result'])nonempty(endpoint[key],endpoint.id+'.'+key);assert.ok([new URL('https://orchesphere.ai').origin,new URL('https://api.orchesphere.ai').origin].includes(new URL(endpoint.url).origin),'Unexpected protocol host');assert.ok(endpoint.limitations.length);}
 assert.equal(documentation.protocol.length,7,'Review public protocol coverage when changing endpoints');
 return {rest:reference.rest.operations.length,mcp:reference.mcp.tools.length,protocol:documentation.protocol.length,version:documentation.version};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const root=new URL('../',import.meta.url),read=name=>JSON.parse(fs.readFileSync(new URL(name,root)));console.log(JSON.stringify(checkDocumentation(read('reference.json'),read('openapi.json'),read('documentation.json'))));}
