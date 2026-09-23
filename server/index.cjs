const path=require('node:path');
const {createApp}=require('./app.cjs');
(async()=>{
 const production=process.env.NODE_ENV==='production';
 const publicOrigin=process.env.PUBLIC_ORIGIN||'';
 if(production&&(!publicOrigin.startsWith('https://')||new URL(publicOrigin).origin!==publicOrigin))throw new Error('Production requires PUBLIC_ORIGIN=https://your-domain with no trailing slash.');
 const app=await createApp({storageDir:path.resolve(process.env.STORAGE_DIR||'.storage'),publicOrigin,secureCookies:production,scheduler:process.env.WEATHER_AUTO_REFRESH!=='false',weatherApiKey:process.env.OPEN_METEO_API_KEY||'',trustProxy:process.env.TRUST_PROXY==='true'});
 const port=Number(process.env.PORT||3000);
 app.server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`shrooms listening on port ${port}`));
 let closing=false;async function stop(){if(closing)return;closing=true;const deadline=setTimeout(()=>process.exit(1),10000);deadline.unref();await app.close();process.exit(0);}
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
