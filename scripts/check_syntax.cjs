const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let count=0;
function check(directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())check(file);
  else if(/\.(js|cjs)$/.test(file)){new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});count++;}
 }
}
for(const directory of ['server','src','scripts','tests','data','vendor'])check(directory);
console.log(`Syntax valid: ${count} JavaScript files`);
