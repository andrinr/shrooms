(function () {
  const stops=[[0,[100,70,163]],[25,[72,142,171]],[50,[80,200,156]],[75,[226,223,93]],[100,[244,102,128]]];
  window.SHROOMS_COLOR = score => {
    const index=stops.findIndex(([value])=>score<=value);
    if(index<=0)return `rgb(${stops[index===0?0:4][1].join(',')})`;
    const [low,a]=stops[index-1], [high,b]=stops[index];
    const t=(score-low)/(high-low);
    return `rgb(${a.map((value,i)=>Math.round(value+(b[i]-value)*t)).join(',')})`;
  };
})();
