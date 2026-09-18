(function () {
  const known=value=>typeof value==='number'&&Number.isFinite(value);
  function parse(item,todayKey) {
    const daily=item.daily,hourly=item.hourly;
    if(!daily?.time)return null;
    const past=daily.time.map((time,i)=>({time,i})).filter(d=>d.time<todayKey).slice(-14);
    const rains=past.map(d=>daily.precipitation_sum?.[d.i]);
    const temps=past.slice(-7).map(d=>daily.temperature_2m_mean?.[d.i]).filter(known);
    // Only completed days: never mistake tonight's forecast for measured history.
    const completed=hourly?.time?.map((time,i)=>({time,i})).filter(d=>d.time.slice(0,10)<todayKey).slice(-24)||[];
    const mean=values=>{const valid=values.filter(known);return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;};
    const sumDays=(key,count)=>{
      const values=past.slice(-count).map(d=>daily[key]?.[d.i]);
      return values.length===count&&values.every(known)?values.reduce((a,b)=>a+b,0):null;
    };
    const sunshine=sumDays('sunshine_duration',7);
    const result={
      sunHours7:known(sunshine)?sunshine/3600:null,
      et014:sumDays('et0_fao_evapotranspiration',14),
      rain14:rains.length===14&&rains.every(known)?rains.reduce((a,b)=>a+b,0):null,
      temp7:temps.length===7?mean(temps):null,
      soil:mean(completed.map(d=>hourly.soil_moisture_3_to_9cm?.[d.i])),
      humidity:mean(completed.map(d=>hourly.relative_humidity_2m?.[d.i]))
    };
    return Object.values(result).some(known)?result:null;
  }
  function usable(snapshot,points,now=new Date()) {
    const age=now.getTime()-snapshot?.at;
    return age>=0 && age<=48*3600000 && snapshot.grid===points.map(p=>p.id).join('|') &&
      Array.isArray(snapshot.entries) && snapshot.entries.length===points.length &&
      snapshot.entries.every(([id,w],i)=>id===i && w && Object.values(w).some(known));
  }
  // Inverse-distance interpolation of regional inputs, not fine-scale measurements.
  function interpolate(cell,points,entries){
    const totals={},weights={};
    points.forEach((point,i)=>{
      const w=entries.get(i);if(!w)return;
      const [x,y]=point.id.split(':').map(Number);
      const distance2=(cell.x-x)**2+(cell.y-y)**2;
      const weight=1/Math.max(1,distance2);
      for(const key of ['rain14','temp7','soil','humidity','sunHours7','et014']){
        if(!known(w[key]))continue;
        totals[key]=(totals[key]||0)+w[key]*weight;weights[key]=(weights[key]||0)+weight;
      }
    });
    if(!Object.keys(weights).length)return undefined;
    return Object.fromEntries(['rain14','temp7','soil','humidity','sunHours7','et014'].map(key=>[key,weights[key]?totals[key]/weights[key]:null]));
  }
  window.SHROOMS_WEATHER={parse,usable,interpolate};
})();
