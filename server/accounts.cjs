const {DatabaseSync}=require('node:sqlite');
const {randomBytes,randomUUID,createHash,scrypt:derive,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');
const fs=require('node:fs');
const path=require('node:path');
const scrypt=promisify(derive),sha=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const token=()=>randomBytes(32).toString('base64url');
function createAccounts(directory,{now=Date.now}={}){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const db=new DatabaseSync(path.join(directory,'shrooms.sqlite'));
 fs.chmodSync(path.join(directory,'shrooms.sqlite'),0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, recovery TEXT NOT NULL, created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS spots(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,lat REAL NOT NULL,lon REAL NOT NULL,species TEXT NOT NULL,cell_id TEXT,notes TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS spots_owner ON spots(user_id);
 PRAGMA user_version=1;`);
 let deriving=0;
 async function hash(password,salt=randomBytes(16).toString('hex')){
  if(typeof password!=='string'||password.length<12||password.length>128)throw fail(400,'Use a password between 12 and 128 characters.');
  if(deriving>=2)throw fail(429,'Please try again in a moment.');
  deriving++;
  try{return `${salt}:${Buffer.from(await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex')}`;}
  finally{deriving--;}
 }
 async function verify(password,encoded){
  if(typeof password!=='string'||password.length<12||password.length>128)return false;
  const actual=await hash(password,encoded.split(':')[0]);
  return timingSafeEqual(Buffer.from(actual),Buffer.from(encoded));
 }
 function session(userId){
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  const raw=token(),csrf=token(),expires=now()+30*86400000;
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(sha(raw),userId,csrf,expires);
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token NOT IN (SELECT token FROM sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 20)').run(userId,userId);
  return {token:raw,csrf};
 }
 function current(raw){
  if(!raw||raw.length>200)return null;
  return db.prepare('SELECT users.id,username,csrf,expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires_at>?').get(sha(raw),now())||null;
 }
 async function register({username,password}){
  if(typeof username!=='string'||! /^[a-zA-Z0-9_]{3,32}$/.test(username))throw fail(400,'Use 3–32 letters, numbers or underscores for your username.');
  username=username.toLowerCase();const encoded=await hash(password),recovery=token(),id=randomUUID();
  try{db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,username,encoded,sha(recovery),now());}
  catch(error){if(error.code?.startsWith('ERR_SQLITE')&&db.prepare('SELECT id FROM users WHERE username=?').get(username))throw fail(409,'That username is already taken.');throw error;}
  return {user:{id,username},recoveryCode:recovery,...session(id)};
 }
 async function login({username,password}){
  const user=typeof username==='string'?db.prepare('SELECT * FROM users WHERE username=?').get(username.toLowerCase()):null;
  // Keep the expensive password check even for unknown usernames.
  const encoded=user?.password||`${'0'.repeat(32)}:${'0'.repeat(128)}`;
  if(!await verify(password,encoded)||!user||!db.prepare('SELECT id FROM users WHERE id=? AND password=?').get(user.id,encoded))throw fail(401,'Username or password is incorrect.');
  return {user:{id:user.id,username:user.username},...session(user.id)};
 }
 async function recover({username,recoveryCode,password}){
  const user=typeof username==='string'?db.prepare('SELECT * FROM users WHERE username=?').get(username.toLowerCase()):null;
  if(!user||typeof recoveryCode!=='string'||!timingSafeEqual(Buffer.from(sha(recoveryCode)),Buffer.from(user.recovery)))throw fail(401,'Username or recovery code is incorrect.');
  const encoded=await hash(password),recovery=token();
  db.exec('BEGIN');try{if(!db.prepare('UPDATE users SET password=?,recovery=? WHERE id=? AND recovery=?').run(encoded,sha(recovery),user.id,user.recovery).changes)throw fail(401,'Recovery code has already been used.');db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  return {user:{id:user.id,username:user.username},recoveryCode:recovery,...session(user.id)};
 }
 function logout(raw){if(raw)db.prepare('DELETE FROM sessions WHERE token=?').run(sha(raw));}
 function listSpots(userId){return db.prepare('SELECT id,name,lat,lon,species,cell_id AS cellId,notes,created_at AS createdAt,updated_at AS updatedAt FROM spots WHERE user_id=? ORDER BY updated_at DESC').all(userId);}
 function saveSpot(userId,input,id=null){
  const {name,lat,lon,species,cellId=null,notes=''}=input;
  if(typeof name!=='string'||!name.trim()||name.length>100||typeof notes!=='string'||notes.length>2000||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<45.7||lat>47.9||lon<5.8||lon>10.7||typeof species!=='string'||species.length>40||!(cellId===null||typeof cellId==='string'&&cellId.length<80))throw fail(400,'Invalid spot. Choose a Swiss map location, a name up to 100 characters and notes up to 2,000 characters.');
  if(id){if(!db.prepare('UPDATE spots SET name=?,lat=?,lon=?,species=?,cell_id=?,notes=?,updated_at=? WHERE id=? AND user_id=?').run(name.trim(),lat,lon,species,cellId,notes,now(),id,userId).changes)throw fail(404,'Spot not found.');}
  else{
   if(db.prepare('SELECT count(*) AS n FROM spots WHERE user_id=?').get(userId).n>=500)throw fail(409,'You can save up to 500 spots.');
   id=randomUUID();db.prepare('INSERT INTO spots VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,userId,name.trim(),lat,lon,species,cellId,notes,now(),now());
  }
  return listSpots(userId).find(s=>s.id===id);
 }
 function deleteSpot(userId,id){if(!db.prepare('DELETE FROM spots WHERE id=? AND user_id=?').run(id,userId).changes)throw fail(404,'Spot not found.');}
 async function removeUser(id,password){const user=db.prepare('SELECT password FROM users WHERE id=?').get(id);if(!user||!await verify(password,user.password))throw fail(401,'Password is incorrect.');db.prepare('DELETE FROM users WHERE id=?').run(id);}
 return {register,login,recover,current,logout,listSpots,saveSpot,deleteSpot,removeUser,close:()=>db.close(),db};
}
module.exports={createAccounts,fail};
