"""Prepare static 500 m forest cells from canton Zürich open geodata.
Run with .venv/bin/python scripts/build_habitat.py [--download].
The deployed website needs none of these Python dependencies.
"""
from pathlib import Path
import argparse, collections, datetime, hashlib, json, math, subprocess
import ijson
import numpy as np
import rasterio
from rasterio.features import rasterize, shapes
from rasterio.transform import Affine
from pyproj import Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform as transform_geometry, unary_union

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
CACHE.mkdir(exist_ok=True)
BASE = 'https://maps.zh.ch/wfs/OGDZHWFS?service=WFS&request=GetFeature&version=2.0.0&count=100000&outputFormat=application%2Fjson&srsName=EPSG:2056&typeNames=ms:'
SOURCES = {
 'stands.json': BASE + 'ogd-0290_giszhpub_wald_luftbildbestand_f',
 'municipalities.json': BASE + 'ogd-0095_arv_basis_up_gemeinden_f',
 'reserves.json': BASE + 'ogd-0046_arv_basis_waldreservat_f',
 'terrain.tif': 'https://wms.zh.ch/DEMWCS?SERVICE=WCS&REQUEST=GetCoverage&VERSION=1.0.0&COVERAGE=dtm&CRS=EPSG:2056&BBOX=2654500,1222400,2720000,1300000&RESX=50&RESY=50&FORMAT=GeoTIFF&INTERPOLATION=bilinear'
}
parser=argparse.ArgumentParser()
parser.add_argument('--download',action='store_true')
if parser.parse_args().download:
 for name, url in SOURCES.items():
  subprocess.run(['curl','--compressed','--fail','--silent','--show-error','--max-time','300',url,'-o',str(CACHE/name)],check=True)

def features(name):
 with (CACHE/name).open('rb') as f:
  yield from ijson.items(f,'features.item',use_float=True)

def valid(value):
 return isinstance(value,(int,float)) and 0 <= value <= 100

def rounded(value):
 if isinstance(value,(list,tuple)): return [rounded(v) for v in value]
 return round(value,5) if isinstance(value,float) else value

with rasterio.open(CACHE/'terrain.tif') as ds:
 elevation = ds.read(1).astype(float)
 elevation[elevation == ds.nodata] = np.nan
 affine, dimensions = ds.transform, elevation.shape
assert abs(affine.a - 50) < 0.01 and abs(affine.e + 50) < 0.01
south, east = np.gradient(elevation,50,50)
slope = np.degrees(np.arctan(np.hypot(south,east)))
aspect = (np.degrees(np.arctan2(-east,south)) + 360) % 360

print('Reading forest stands…',flush=True)
properties=[{}]; geometries=[]; source_count=0
for f in features('stands.json'):
 source_count += 1
 p=f['properties']
 # Code 10 is mapped forest. Fields, hedges and unclassified infill are omitted.
 if p.get('flcodelb') != 10 or not f.get('geometry'): continue
 geometry=shape(f['geometry']).simplify(3,preserve_topology=True)
 if geometry.is_empty: continue
 index=len(properties); properties.append(p); geometries.append((geometry,index))
print(f'Rasterizing {len(geometries):,} forest stands…',flush=True)
stand_ids=rasterize(geometries,out_shape=dimensions,transform=affine,dtype='int32')
del geometries
municipalities=list(features('municipalities.json'))
municipal_ids=rasterize([(shape(f['geometry']),i+1) for i,f in enumerate(municipalities)],out_shape=dimensions,transform=affine,dtype='int16')
reserves=list(features('reserves.json'))
reserve_mask=rasterize([(shape(f['geometry']),1) for f in reserves],out_shape=dimensions,transform=affine,dtype='uint8').astype(bool)
# Municipality mask guarantees that no sample crosses into another canton.
land_mask=np.zeros(dimensions,dtype=bool)
for i,f in enumerate(municipalities):
 if f['properties'].get('gemeindename'): land_mask |= municipal_ids == i+1
forest_mask=(stand_ids>0)&land_mask
usable=forest_mask
projection=Transformer.from_crs(2056,4326,always_xy=True).transform
cells=[]; weather=[]; weather_lookup={}
print('Aggregating 500 m cells and forest masks…',flush=True)
for row in range(0,dimensions[0],10):
 for col in range(0,dimensions[1],10):
  section=np.s_[row:row+10,col:col+10]
  mask=usable[section]
  if np.count_nonzero(mask)<3: continue
  ids=stand_ids[section][mask]
  counts=collections.Counter(map(int,ids))
  stand_area=sum(counts.values())
  def average(key):
   values=[(properties[i].get(key),n) for i,n in counts.items() if valid(properties[i].get(key))]
   return round(sum(v*n for v,n in values)/sum(n for _,n in values),1) if values else None
  canopy=average('dg'); broadleaf=average('prlbh'); conifer=average('prndh')
  beech=average('prbu'); oak=average('prei'); spruce=average('prfi'); fir=average('prta'); pine=average('prfo')
  canopy_known=sum(n for i,n in counts.items() if valid(properties[i].get('dg')))/stand_area
  tree_known=sum(n for i,n in counts.items() if valid(properties[i].get('prndh')) and valid(properties[i].get('prlbh')) and properties[i].get('prndh',0)+properties[i].get('prlbh',0)>0)/stand_area
  years=[properties[i].get('flugjahr') for i in counts if properties[i].get('flugjahr')]
  local_affine=affine*Affine.translation(col,row)
  polygons=[shape(g) for g,v in shapes(mask.astype('uint8'),mask=mask,transform=local_affine) if v==1]
  geom=unary_union(polygons)
  representative=geom.representative_point()
  lon,lat=projection(representative.x,representative.y)
  x,y=map(float,representative.coords[0])
  grid_x=round(x/10000)*10000; grid_y=round(y/10000)*10000
  key=f'{grid_x}:{grid_y}'
  if key not in weather_lookup:
   weather_lookup[key]=len(weather)
   wlon,wlat=projection(grid_x,grid_y)
   weather.append({'id':key,'lat':round(wlat,5),'lon':round(wlon,5)})
  local_muni=municipal_ids[section][mask]
  mi=collections.Counter(map(int,local_muni)).most_common(1)[0][0]-1
  town=municipalities[mi]['properties'].get('gemeindename','Zürich canton')
  district=municipalities[mi]['properties'].get('bezirksname','')
  def median(array):
   values=array[section][mask]; values=values[np.isfinite(values)]
   return round(float(np.median(values)),1) if len(values) else None
  terrain_ok=np.isfinite(slope[section][mask])
  aspects=aspect[section][mask][terrain_ok]
  aspect_mean=round(float(np.degrees(np.arctan2(np.mean(np.sin(np.radians(aspects))),np.mean(np.cos(np.radians(aspects)))))%360)) if len(aspects) else None
  geometry=mapping(transform_geometry(projection,geom))
  geometry={'type':geometry['type'],'coordinates':rounded(geometry['coordinates'])}
  cells.append({'type':'Feature','geometry':geometry,'properties':{
   'id':f'{row}-{col}','name':town,'district':district,'lat':round(lat,5),'lon':round(lon,5),
   'x':round(x),'y':round(y),'forest':round(np.mean(forest_mask[section])*100),
   'reservePercent':round(float(np.mean(reserve_mask[section][mask])*100),1),
   'area':round(stand_area*2500/10000,2),'canopy':canopy,'canopyKnown':round(canopy_known,2),
   'broadleaf':broadleaf,'conifer':conifer,'beech':beech,'oak':oak,'spruce':spruce,'fir':fir,'pine':pine,
   'treeKnown':round(tree_known,2),'slope':median(slope),'aspect':aspect_mean,'elevation':median(elevation),
   'yearMin':min(years) if years else None,'yearMax':max(years) if years else None,'weather':weather_lookup[key]
  }})

assert source_count < 100000, 'WFS limit reached; pagination required before rebuilding.'
assert source_count > 90000, f'Forest source may be truncated: {source_count}'
assert len(cells)>1000 and len(weather)>10
def source_hash(path):
 digest=hashlib.sha256()
 with path.open('rb') as stream:
  for chunk in iter(lambda:stream.read(1024*1024),b''): digest.update(chunk)
 return digest.hexdigest()

metadata={
 'generated':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'cellSizeMeters':500,'maskResolutionMeters':50,'terrainResolutionMeters':50,
 'sourceStandCount':source_count,'usedStandCount':len(properties)-1,'cellCount':len(cells),
 'forestAreaKm2':round(float(np.count_nonzero(forest_mask)*0.0025),2),
 'mappedReserveForestAreaKm2':round(float(np.count_nonzero(forest_mask&reserve_mask)*0.0025),2),
 'sources':{name:{'url':url,'sha256':source_hash(CACHE/name)} for name,url in SOURCES.items()},
 'credit':'Geografisches Informationssystem des Kantons Zürich (GIS-ZH), Luftbild-Bestandeskarte, Gemeinden, Waldreservate, DTM 2022',
 'limits':'50 m raster mask; cells under 0.75 ha omitted. Forest reserves included in habitat scores; collecting may be forbidden; other protected areas and local restrictions are not comprehensively mapped.'
}
result={'metadata':metadata,'weatherPoints':weather,'type':'FeatureCollection','features':cells}
(ROOT/'data').mkdir(exist_ok=True)
from pack_habitat import pack
pack(result)
(ROOT/'data'/'sources.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
print(f'Wrote {len(cells):,} forest cells, {len(weather)} weather anchors, {metadata["forestAreaKm2"]} km² forest; {metadata["mappedReserveForestAreaKm2"]} km² forest in mapped reserves (included).',flush=True)
