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
    const result={
      rain14:rains.length===14&&rains.every(known)?rains.reduce((a,b)=>a+b,0):null,
      temp7:temps.length===7?mean(temps):null,
      soil:mean(completed.map(d=>hourly.soil_moisture_3_to_9cm?.[d.i])),
      humidity:mean(completed.map(d=>hourly.relative_humidity_2m?.[d.i]))
    };
    return Object.values(result).some(known)?result:null;
  }
  window.SHROOMS_WEATHER={parse};
})();
