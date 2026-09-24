/* Area-weighted display summaries; the underlying regional model is unchanged. */
(function () {
  const resolution=zoom=>zoom<=10?1000:zoom<13?500:100;
  function group(cells,meters){
    const groups=new Map(),step=meters/50;
    for(const cell of cells){
      const [row,col]=cell.id.split('-').map(Number);
      const key=`${Math.floor(row/step)}-${Math.floor(col/step)}`;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(cell);
    }
    return [...groups.values()];
  }
  function summarize(cells,scores){
    const area=cells.reduce((sum,c)=>sum+c.area,0);
    const mean=fn=>cells.reduce((sum,c)=>sum+fn(c)*c.area,0)/area;
    return {lat:mean(c=>c.lat),lon:mean(c=>c.lon),value:mean(c=>scores.get(c.id).value),
      treeKnown:mean(c=>c.treeKnown),conifer:mean(c=>c.conifer||0),broadleaf:mean(c=>c.broadleaf||0),count:cells.length};
  }
  function factors(cells,scores){
    return Object.fromEntries(['tree','canopy','moisture','temperature','terrain','season','soil'].map(key=>{
      let sum=0,area=0;
      for(const cell of cells){const value=scores.get(cell.id).factors[key]?.value;if(Number.isFinite(value)){sum+=value*cell.area;area+=cell.area;}}
      return [key,area?sum/area:null];
    }));
  }
  window.SHROOMS_ADAPTIVE={resolution,group,summarize,factors};
})();
