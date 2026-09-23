"""Build regional Swiss habitat bundles from official cached sources.

Sources: swissTLMRegio 2026 (100 m forest mask), NFI mix (10 m), DHM25/200.
Run .venv/bin/python scripts/build_switzerland.py after scripts/download_switzerland.py.
National tree-species/canopy data are unavailable and remain null, never invented.
"""
import json,sqlite3,collections,gzip,base64,hashlib,datetime,html
from pathlib import Path
import numpy as np
import rasterio
from rasterio.features import rasterize,shapes
from rasterio.transform import Affine
from rasterio.warp import reproject,Resampling
from shapely import wkb
from shapely.geometry import shape,mapping,box
from shapely.ops import transform,unary_union
from pyproj import Transformer
from pack_habitat import write_chunk
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache'
CODES=['','zh','be','lu','ur','sz','ow','nw','gl','zg','fr','so','bs','bl','sh','ar','ai','sg','gr','ag','tg','ti','vd','vs','ne','ge','ju']
product=sqlite3.connect(CACHE/'swiss-tlm/swissTLMRegio_Product_LV95.gpkg');product.row_factory=sqlite3.Row
boundaries=sqlite3.connect(CACHE/'swiss-tlm/swissTLMRegio_BOUNDARIES_LV95.gpkg');boundaries.row_factory=sqlite3.Row
def geometry(blob):
 flag=blob[3];envelope=(flag>>1)&7;offset=8+[0,32,48,48,64][envelope]
 return wkb.loads(blob[offset:])
def records(db,table,where='1'):
 return [(dict(row),geometry(row['geom'])) for row in db.execute(f'SELECT * FROM {table} WHERE {where}')]
municipalities=records(boundaries,'swisstlmregio_hoheitsgebiet',"icc='CH'")
cantons=records(boundaries,'swisstlmregio_kantonsgebiet',"icc='CH'")
country=unary_union([g for _,g in cantons]);print('Rasterizing national forest and municipalities',flush=True)
affine=Affine(100,0,2480000,0,-100,1300000);dims=(2300,3600)
muni=rasterize([(g,i+1) for i,(_,g) in enumerate(municipalities)],out_shape=dims,transform=affine,dtype='int16')
forest=rasterize([(g,1) for _,g in records(product,'tlmregio_landcover_landcover',"objval='Wald'")],out_shape=dims,transform=affine,dtype='uint8').astype(bool)&(muni>0)
with rasterio.open(CACHE/'swiss-mix.tif') as ds:
 mix=ds.read(1,out_shape=dims,resampling=Resampling.average).astype(float);mix[(mix<0)|(mix>100)]=np.nan
# DHM25/200 uses LV03, explicitly reproject it rather than assuming an offset.
demfile=next((CACHE/'swiss-dem').rglob('*.asc'))
with rasterio.open(demfile) as ds:
 raw=ds.read(1).astype(float);raw[raw==ds.nodata]=np.nan
 sy,sx=np.gradient(raw,200,200);raw_slope=np.degrees(np.arctan(np.hypot(sx,sy)))
 raw_aspect=np.arctan2(-sx,sy)
 def warp(source):
  out=np.full(dims,np.nan,dtype='float32');reproject(source,out,src_transform=ds.transform,src_crs=ds.crs or 'EPSG:21781',dst_transform=affine,dst_crs='EPSG:2056',src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.bilinear);return out
 elevation=warp(raw);slope=warp(raw_slope);aspect=(np.degrees(np.arctan2(warp(np.sin(raw_aspect)),warp(np.cos(raw_aspect))))+360)%360
project=Transformer.from_crs(2056,4326,always_xy=True).transform
mercator=Transformer.from_crs(2056,3857,always_xy=True).transform
back=Transformer.from_crs(3857,4326,always_xy=True).transform
rows,cols=np.where(forest);xs=2480000+cols*100+50;ys=1300000-rows*100-50
lons,lats=project(xs,ys)
weatherkeys=sorted(set((int(round(x/20000)*20000),int(round(y/20000)*20000)) for x,y in zip(xs,ys)))
weather=[];weatherids={}
for x,y in weatherkeys:
 lon,lat=project(x,y);weatherids[(x,y)]=len(weather);weather.append({'id':f'{x}:{y}','lat':round(lat,5),'lon':round(lon,5)})
region_positions=collections.defaultdict(list)
for i,(r,c) in enumerate(zip(rows,cols)):
 code=CODES[int(municipalities[muni[r,c]-1][0]['kantonsnummer'][2:4])];region_positions[code].append(i)
sourceinfo={name:hashlib.sha256((CACHE/name).read_bytes()).hexdigest() for name in ['swiss-tlm.zip','swiss-mix.tif','swiss-dem.zip']}
metadata={'generated':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cellSizeMeters':100,'maskResolutionMeters':100,'terrainResolutionMeters':200,'credit':'© swisstopo swissTLMRegio 2026, DHM25/200; FOEN / WSL NFI forest mix 2023','sources':sourceinfo,'limits':'Generalized forest boundaries rasterized at 100 m. Terrain source 200 m. Canopy and individual host-tree species are unavailable. Regional weather, not local measurements. Protection overlay is incomplete.'}
def rounded(value):
 if isinstance(value,(tuple,list)):return [rounded(x) for x in value]
 return round(value,5) if isinstance(value,float) else value

def pack_region(code,cells,tilegroups,size):
 tiles=[]
 for tile,items in sorted(tilegroups.items()):
  coords=[]
  def points(v):
   if isinstance(v[0],(int,float)):yield v
   else:
    for child in v:yield from points(child)
  for item in items:coords.extend(points(item['geometry']['coordinates']))
  tiles.append({'key':tile,'bounds':[[min(p[1] for p in coords),min(p[0] for p in coords)],[max(p[1] for p in coords),max(p[0] for p in coords)]],'bytes':write_chunk(tile,items),'count':len(items)})
 meta={**metadata,'cellSizeMeters':size,'cellCount':len(cells),'region':code}
 write_chunk(f'regions/{code}/index',{'metadata':meta,'weatherPoints':weather,'cells':cells,'tiles':tiles})
 return meta
regions=[];overviewgroups=collections.defaultdict(list)
for code,positions in sorted(region_positions.items()):
 cells=[];tiles=collections.defaultdict(list)
 # Zürich keeps the higher-resolution GIS-ZH survey, not the national substitute.
 for i in positions:
  r,c=int(rows[i]),int(cols[i]);x,y=int(xs[i]),int(ys[i]);p=municipalities[muni[r,c]-1][0]
  broad=float(mix[r,c]);known=np.isfinite(broad)
  key=f'regions/{code}/tiles/{r//50}-{c//50}'
  def val(array):return round(float(array[r,c]),1) if np.isfinite(array[r,c]) else None
  cell={'id':f'{r*2}-{c*2}','name':p['name'],'district':code.upper(),'lat':round(float(lats[i]),5),'lon':round(float(lons[i]),5),'x':x,'y':y,'forest':100,'area':1,'canopy':None,'canopyKnown':0,'broadleaf':round(broad,1) if known else None,'conifer':round(100-broad,1) if known else None,'beech':None,'oak':None,'spruce':None,'fir':None,'pine':None,'treeKnown':1 if known else 0,'slope':val(slope),'aspect':val(aspect),'elevation':val(elevation),'yearMin':2023,'yearMax':2023,'weather':weatherids[(round(x/20000)*20000,round(y/20000)*20000)],'reservePercent':None,'tile':key,'region':code}
  overviewgroups[(r//5,c//5)].append(cell)
  if code!='zh':
   cells.append(cell);geom=mapping(transform(project,box(x-50,y-50,x+50,y+50)));geom['coordinates']=rounded(geom['coordinates']);tiles[key].append({'id':cell['id'],'geometry':geom})
 if code!='zh':
  meta=pack_region(code,cells,tiles,100);regions.append({'id':code,'name':next(p['name'] for p,g in cantons if p['kantonsnummer'][2:4]==f'{CODES.index(code):02d}'),'cellCount':len(cells),'cellSizeMeters':100,'index':f'regions/{code}/index'})
 print(f'{code}: {len(positions):,} forest samples',flush=True)
# A lightweight national score index and forest-shaped 500 m summary geometry.
cells=[];tiles=collections.defaultdict(list)
for (gr,gc),members in overviewgroups.items():
 r,c=gr*5,gc*5;mask=forest[r:r+5,c:c+5];cell=dict(members[0]);cell.update(id=f'{r*2}-{c*2}',area=len(members),forest=round(len(members)/25*100),tile=f'regions/ch/tiles/{gr//20}-{gc//20}')
 for field in ['lat','lon','x','y','broadleaf','conifer','slope','elevation','treeKnown']:
  values=[m[field] for m in members if m[field] is not None];cell[field]=round(sum(values)/len(values),5 if field in ['lat','lon'] else 1) if values else None
 angles=[m['aspect'] for m in members if m['aspect'] is not None];cell['aspect']=round(float(np.degrees(np.arctan2(np.mean(np.sin(np.radians(angles))),np.mean(np.cos(np.radians(angles)))))%360),1) if angles else None
 geom=unary_union([shape(g) for g,v in shapes(mask.astype('uint8'),mask=mask,transform=affine*Affine.translation(c,r)) if v]);out=mapping(transform(project,geom));out['coordinates']=rounded(out['coordinates']);cells.append(cell);tiles[cell['tile']].append({'id':cell['id'],'geometry':out})
pack_region('ch',cells,tiles,500)
regions.insert(0,{'id':'ch','name':'Switzerland','cellCount':len(cells),'cellSizeMeters':500,'index':'regions/ch/index'})
regions.insert(1,{'id':'zh','name':'Zürich','cellSizeMeters':50,'index':'index'})
write_chunk('regions',{'regions':regions,'weatherPoints':weather,'metadata':metadata})
print(f'National overview: {len(cells):,}; weather anchors: {len(weather)}',flush=True)
# Bundled national basemap: official canton outlines, lakes, major roads and towns.
projected=[(p,transform(mercator,g).simplify(80)) for p,g in cantons];minx,miny,maxx,maxy=unary_union([g for _,g in projected]).bounds;scale=1800/(maxx-minx)
def svgpath(g):
 if g.geom_type=='Polygon':parts=[g]
 elif g.geom_type=='MultiPolygon':parts=list(g.geoms)
 elif g.geom_type=='LineString':return 'M'+'L'.join(f'{(x-minx)*scale:.2f},{(maxy-y)*scale:.2f}' for x,y,*_ in g.coords)
 else:return ''
 return ''.join('M'+'L'.join(f'{(x-minx)*scale:.2f},{(maxy-y)*scale:.2f}' for x,y,*_ in ring.coords)+'Z' for p in parts for ring in [p.exterior,*p.interiors])
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 {(maxy-miny)*scale:.2f}"><title>Switzerland — © swisstopo</title>']
for p,g in projected:svg.append(f'<path d="{svgpath(g)}" fill="#efeddf" stroke="#b9adc3" stroke-width=".6"/>')
for p,g in records(product,'tlmregio_hydrography_lake'):
 if not g.intersects(country):continue
 svg.append(f'<path d="{svgpath(transform(mercator,g).simplify(70))}" fill="#c6dedd"/>')
for p,g in records(product,'tlmregio_transportation_road',"objval IN ('Autobahn','Autostr','HauptStrAB4','HauptStrAB6')"):
 if not g.intersects(country):continue
 svg.append(f'<path d="{svgpath(transform(mercator,g).simplify(90))}" fill="none" stroke="#b8a493" stroke-width=".55"/>')
svg.append('</svg>');(ROOT/'data/switzerland.svg').write_text(''.join(svg))
labels=[]
for p,g in records(product,'tlmregio_names_namedlocation',"objval IN ('HOrtschaft1','HOrtschaft2','HOrtschaft3','HOrtschaft4','GOrtschaft')"):
 if not country.covers(g):continue
 lon,lat=project(g.x,g.y);major=p['objval'] in ['HOrtschaft2','HOrtschaft3','HOrtschaft4'];labels.append({'name':p['namn1'],'lat':round(lat,5),'lon':round(lon,5),'minZoom':7 if major else 10,'kind':'city' if major else 'town'})
southwest=back(minx,miny);northeast=back(maxx,maxy);write_chunk('switzerland-map',{'bounds':[[southwest[1],southwest[0]],[northeast[1],northeast[0]]],'labels':labels})
print('National basemap ready',flush=True)
