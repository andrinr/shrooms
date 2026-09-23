/* Same-origin API discovery; static and file previews remain supported. */
window.SHROOMS_SERVICE=(()=>{
 let config;
 const ready=(async()=>{
  if(!/^https?:$/.test(location.protocol))return null;
  try{const response=await fetch('./api/config',{signal:AbortSignal.timeout(4000)});if(!response.ok)return null;const value=await response.json();if(value.apiVersion!==1)return null;config=value;return value;}catch{return null;}
 })();
 async function request(route,{method='GET',body,csrf}={}){
  const response=await fetch(`./api/${route}`,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const value=await response.json();if(!response.ok)throw new Error(value.error||'Request failed.');return value;
 }
 return {ready,request,get config(){return config;}};
})();
