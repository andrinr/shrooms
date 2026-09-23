// Online SQLite backup: never copy only the main database while WAL writes run.
const {DatabaseSync,backup}=require('node:sqlite');
const path=require('node:path'),fs=require('node:fs');
(async()=>{
 const directory=path.resolve(process.env.STORAGE_DIR||'.storage');
 const target=path.resolve(process.argv[2]||path.join(directory,'backups',`shrooms-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`));
 fs.mkdirSync(path.dirname(target),{recursive:true});
 const db=new DatabaseSync(path.join(directory,'shrooms.sqlite'),{readOnly:true});
 try{await backup(db,target);fs.chmodSync(target,0o600);console.log(target);}finally{db.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
