// Explicit allowlist: never publish raw geodata, developer caches, or repository metadata.
const fs=require('node:fs');
fs.rmSync('_site',{recursive:true,force:true});
fs.mkdirSync('_site');
for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md','index.html','styles.css','favicon.svg','forest-magic.svg','.nojekyll','vendor','src','data']){
 fs.cpSync(name,`_site/${name}`,{recursive:true});
}
console.log('Static site packaged in _site/');
