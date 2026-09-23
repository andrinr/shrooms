(function () {
  const stops=[[0,[106,85,135]],[25,[103,91,201]],[50,[42,176,166]],[75,[226,228,81]],[100,[244,57,135]]];
  window.SHROOMS_COLOR = score => {
    const value=Math.max(0,Math.min(100,score));
    const index=stops.findIndex(([stop])=>value<=stop);
    if(index<=0)return `rgb(${stops[0][1].join(',')})`;
    const [low,a]=stops[index-1], [high,b]=stops[index];
    const t=(value-low)/(high-low);
    return `rgb(${a.map((channel,i)=>Math.round(channel+(b[i]-channel)*t)).join(',')})`;
  };
  // Viewport endpoints follow the displayed tiles. A minimum span avoids
  // exaggerating tiny differences when all cells have nearly equal scores.
  window.SHROOMS_HEAT_SCALE = values => {
    const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
    let low=sorted.length?sorted[Math.floor((sorted.length-1)*.1)]:0;
    let high=sorted.length?sorted[Math.ceil((sorted.length-1)*.95)]:100;
    if(high-low<10){const midpoint=(high+low)/2;low=Math.max(0,Math.min(90,midpoint-5));high=low+10;}
    return {low,high,normalize:score=>Math.max(0,Math.min(100,(score-low)/(high-low)*100))};
  };
})();
