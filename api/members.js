const crypto = require('node:crypto');
const seed = require('../data/members.json');
const KEY = 'ldbc:members:v1';
const columns = ['name','role','company','position','industry','phone','email','address','branches','website','facebook','zalo','intro','notes'];
function config() { return {url:process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, token:process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN, password:process.env.LDBC_ADMIN_PASSWORD}; }
function missing(c) { const m=[]; if(!c.url)m.push('redis_url'); if(!c.token)m.push('redis_token'); if(!c.password)m.push('password'); else if(c.password.length<16)m.push('password_too_short'); return m; }
function configured(c) { return !!(c.url && c.token && c.password && c.password.length >= 16); }
async function redis(command,c) {
 const r=await fetch(c.url,{method:'POST',headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('storage');const data=await r.json();if(data.error)throw Error('storage');return data.result;
}
const digest=s=>crypto.createHash('sha256').update(String(s)).digest();
function signature(exp,c){return crypto.createHmac('sha256',c.password).update('ldbc-admin:'+exp).digest('hex');}
function authenticated(req,c){const value=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ldbc_session='))?.slice(13)||'';const [exp,sig]=value.split('.');return /^\d+$/.test(exp||'')&&Number(exp)>Date.now()&&Number(exp)<Date.now()+9*3600000&&/^[a-f0-9]{64}$/.test(sig||'')&&crypto.timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(exp,c),'hex'));}
function cleanMembers(input){
 if(!Array.isArray(input)||input.length>500)throw Error('Tối đa 500 thành viên mỗi danh sách.');const ids=new Set();
 const result=input.map(m=>{if(!m||typeof m.id!=='string'||!/^[\w-]{1,100}$/.test(m.id)||ids.has(m.id))throw Error('Mã thành viên không hợp lệ hoặc trùng.');ids.add(m.id);const n={id:m.id};for(const key of columns){const v=m[key]??'';if(typeof v!=='string'||v.length>12000)throw Error('Thông tin thành viên quá dài.');n[key]=v.trim();}if(!n.name||n.name.length>200)throw Error('Hãy điền họ tên hợp lệ.');const p=m.photo||'';if(typeof p!=='string'||p.length>350000||(p&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p)))throw Error('Ảnh không hợp lệ.');n.photo=p;return n;});
 if(Buffer.byteLength(JSON.stringify(result))>3000000)throw Error('Danh sách vượt 3 MB; hãy giảm dung lượng ảnh hoặc số hồ sơ.');return result;
}
const publicMembers=members=>members.map(({notes,...m})=>m);
const SAVE_SCRIPT=`local old=redis.call('GET',KEYS[1]); local version=0; if old then version=cjson.decode(old).revision end; if version~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1`;
const RATE_SCRIPT=`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],600) end; return n`;
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,body)=>res.status(status).json(body),c=config();
 try{
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(405,{error:'Phương thức không hỗ trợ.'});}
  if(!configured(c)){if(req.method==='GET')return send(200,{configured:false,admin:false,revision:0,missing:missing(c),members:publicMembers(seed.members)});return send(503,{error:'Chưa cấu hình kho dữ liệu và mật khẩu quản trị trên Vercel.'});}
  const admin=authenticated(req,c);
  if(req.method==='GET'){const raw=await redis(['GET',KEY],c),state=raw?JSON.parse(raw):{revision:0,members:seed.members};return send(200,{configured:true,admin,revision:state.revision,members:admin?state.members:publicMembers(state.members)});}
  // Browser writes must originate on this deployment. No permissive CORS.
  let origin;try{origin=new URL(req.headers.origin);}catch{return send(403,{error:'Nguồn yêu cầu không hợp lệ.'});}
  if(origin.host!==req.headers.host||origin.protocol!=='https:')return send(403,{error:'Nguồn yêu cầu không hợp lệ.'});
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch{return send(400,{error:'Dữ liệu không hợp lệ.'})}}if(!b||typeof b!=='object')return send(400,{error:'Dữ liệu không hợp lệ.'});
  if(b.action==='login'){
   const ip=String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown').split(',')[0];
   const attempts=await redis(['EVAL',RATE_SCRIPT,1,'ldbc:login:'+digest(ip).toString('hex')],c);if(attempts>10)return send(429,{error:'Thử đăng nhập quá nhiều. Vui lòng chờ 10 phút.'});
   if(typeof b.password!=='string'||b.password.length>512||!crypto.timingSafeEqual(digest(b.password),digest(c.password)))return send(401,{error:'Mật khẩu chưa đúng.'});
   const exp=String(Date.now()+8*3600000);res.setHeader('Set-Cookie',`ldbc_session=${exp}.${signature(exp,c)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);return send(200,{ok:true});
  }
  if(b.action==='logout'){res.setHeader('Set-Cookie','ldbc_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');return send(200,{ok:true});}
  if(!admin)return send(401,{error:'Phiên đăng nhập đã hết. Hãy sao lưu bản đang sửa trước khi đăng nhập lại.'});
  if(b.action!=='save'||!Number.isSafeInteger(b.revision)||b.revision<0)return send(400,{error:'Yêu cầu lưu không hợp lệ.'});
  let members;try{members=cleanMembers(b.members)}catch(e){return send(400,{error:e.message})}
  const next={revision:b.revision+1,updatedAt:new Date().toISOString(),members};const saved=await redis(['EVAL',SAVE_SCRIPT,1,KEY,b.revision,JSON.stringify(next)],c);
  if(!saved)return send(409,{error:'Danh sách đã thay đổi ở thiết bị khác. Hãy sao lưu bản đang sửa, rồi tải bản mới để đối chiếu.'});return send(200,{ok:true,revision:next.revision,updatedAt:next.updatedAt});
 }catch{return send(503,{error:'Chưa kết nối được kho dữ liệu. Thay đổi chưa được đăng lên website; hãy giữ bản sao lưu và thử lại.'});}
};
module.exports.cleanMembers=cleanMembers;module.exports.publicMembers=publicMembers;
