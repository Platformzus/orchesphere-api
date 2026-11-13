import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/analytics.mjs').catch(()=>({}));
const config={measurementId:'G-SYNTHETIC1',origin:'https://api.orchesphere.ai',path:'/reference/rest/readIdentity?token=private#secret',allowedPaths:['/','/reference/rest/readIdentity'],storageKey:'synthetic-consent'};
function fixture(saved=null){const sent=[],stopped=[],writes=[];let privacy=false;return {sent,stopped,writes,setPrivacy:v=>{privacy=v;},create(extra={}){return api.analyticsController({...config,...extra},{now:()=>100,read:()=>saved,save:v=>{saved=v;writes.push(v);},privacy:()=>privacy,send:v=>sent.push(v),stop:()=>stopped.push(true)});}};}
test('documentation collection is silent until consent and never sends queries, referrers or titles',()=>{
 assert.equal(typeof api.analyticsController,'function');const f=fixture(),c=f.create();assert.equal(f.sent.length,0);c.choose('accepted');assert.deepEqual(f.sent,[{page_location:'https://api.orchesphere.ai/reference/rest/readIdentity',page_title:'/reference/rest/readIdentity',page_referrer:''}]);assert.equal(f.writes[0].gaId,'G-SYNTHETIC1');c.refresh();assert.equal(f.sent.length,1);c.choose('declined');assert.ok(f.stopped.length);assert.equal(c.state().choice,'declined');
});
test('privacy signals override consent, including a signal enabled during an open page',()=>{
 assert.equal(typeof api.analyticsController,'function');const f=fixture();f.setPrivacy(true);const c=f.create();c.choose('accepted');assert.equal(f.sent.length,0);assert.equal(c.state().privacyDisabled,true);f.setPrivacy(false);c.refresh();assert.equal(f.sent.length,1);f.setPrivacy(true);c.refresh();assert.equal(f.sent.length,1);assert.ok(f.stopped.length);
});
test('expired consent or a changed measurement destination requires a fresh choice',()=>{
 assert.equal(typeof api.analyticsController,'function');for(const saved of [{version:1,choice:'accepted',gaId:'G-OTHER1234',expires:1000},{version:1,choice:'accepted',gaId:config.measurementId,expires:99}]){const f=fixture(saved),c=f.create();assert.equal(c.state().choice,null);assert.equal(f.sent.length,0);}const f=fixture({version:1,choice:'accepted',gaId:config.measurementId,expires:1000});f.create();assert.equal(f.sent.length,1);
});
test('only explicit canonical page paths and the configured origin are collected',()=>{
 assert.equal(typeof api.analyticsController,'function');for(const path of ['/v1/workspaces/private','/oauth/authorize','/sign-in','//evil.test','https://evil.test/']){const f=fixture(),c=f.create({path});c.choose('accepted');assert.equal(f.sent.length,0,path);}assert.throws(()=>api.analyticsController({...config,origin:'https://evil.test/?token=secret'},{}));
});
