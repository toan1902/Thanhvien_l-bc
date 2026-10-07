const test=require('node:test'),assert=require('node:assert/strict');
const handler=require('../api/members');
process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test';process.env.UPSTASH_REDIS_REST_TOKEN='test-only';process.env.LDBC_ADMIN_PASSWORD='test-password-not-for-production';
let state=null,history=[],count=0,fail=false;
global.fetch=async(url,options)=>{if(fail)throw Error('offline');const cmd=JSON.parse(options.body);let result;if(cmd[0]==='GET')result=state;if(cmd[0]==='LRANGE')result=history;if(cmd[0]==='EVAL'&&cmd[3].startsWith('ldbc:login:'))result=++count;else if(cmd[0]==='EVAL'){const current=state?JSON.parse(state).revision:0;result=current===cmd[5]?1:0;if(result){if(state)history=[state,...history].slice(0,30);state=cmd[6];}}return {ok:true,json:async()=>({result})}};
async function call(method,body,cookie='',origin='https://site.test',url='/api/members'){const req={method,url,body,headers:{host:'site.test',origin,cookie,'x-real-ip':'127.0.0.1'}},res={headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(b){this.body=b;return this}};await handler(req,res);return res;}
test('authentication, privacy, version conflict and outages',async()=>{
 const initial=await call('GET');assert.equal(initial.code,200);assert.equal(initial.body.admin,false);assert.ok(initial.body.members.every(m=>!('notes'in m)));
 assert.equal((await call('POST',{action:'save',revision:0,members:[]})).code,401);
 assert.equal((await call('POST',{action:'login',password:process.env.LDBC_ADMIN_PASSWORD},'','https://evil.test')).code,403);
 assert.equal((await call('POST',{action:'login',password:'wrong'})).code,401);
 const login=await call('POST',{action:'login',password:process.env.LDBC_ADMIN_PASSWORD});assert.equal(login.code,200);assert.match(login.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);const cookie=login.headers['Set-Cookie'].split(';')[0];
 const member={id:'m-1',name:'Lê An',notes:'private-note',phone:'0901234567'};
 assert.equal((await call('POST',{action:'save',revision:0,members:[member]},cookie)).code,200);
 assert.equal((await call('GET')).body.members[0].notes,undefined);
 assert.equal((await call('GET',null,cookie)).body.members[0].notes,'private-note');
 assert.equal((await call('POST',{action:'save',revision:0,members:[]},cookie)).code,409);assert.equal(JSON.parse(state).members.length,1);
 assert.equal((await call('POST',{action:'save',revision:1,members:[{...member,name:'Lê Bình'}]},cookie)).code,200);
 assert.equal((await call('GET',null,'','https://site.test','/api/members?history=1')).code,401);
 const hist=await call('GET',null,cookie,'https://site.test','/api/members?history=1');assert.equal(hist.code,200);assert.deepEqual(hist.body.history.map(h=>[h.revision,h.count,h.names[0]]),[[1,1,'Lê An']]);
 const old=await call('GET',null,cookie,'https://site.test','/api/members?history=1&revision=1');assert.equal(old.body.members[0].name,'Lê An');
 assert.equal((await call('GET',null,cookie,'https://site.test','/api/members?history=1&revision=9')).code,404);
 assert.equal((await call('POST',{action:'save',revision:2,members:[member,member]},cookie)).code,400);
 assert.equal((await call('POST',{action:'save',revision:1,members:[{...member,photo:'data:image/svg+xml;base64,AAA='}]},cookie)).code,400);
 fail=true;assert.equal((await call('GET')).code,503);fail=false;
 count=10;assert.equal((await call('POST',{action:'login',password:'wrong'})).code,429);
 process.env.LDBC_ADMIN_PASSWORD='different-password-16';assert.equal((await call('POST',{action:'save',revision:1,members:[]},cookie)).code,401);
 delete process.env.UPSTASH_REDIS_REST_TOKEN;assert.equal((await call('GET')).body.configured,false);assert.equal((await call('POST',{action:'login'})).code,503);
});
