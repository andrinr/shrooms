"""Clip overview score cells to native swissTLM3D forest coverage for lightweight canvas rendering."""
import base64,gzip,json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.transform import Affine
from shapely.geometry import shape,mapping,box
from shapely.ops import transform
from pyproj import Transformer
ROOT=Path(__file__).resolve().parents[1]
def unpack(key):
 s=(ROOT/'data'/f'{key}.js').read_text();return json.loads(gzip.decompress(base64.b64decode(json.loads(s.split('=',1)[1].strip().rstrip(';')))))
def pack(key,value):
 p=ROOT/'data'/f'{key}.js';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(f'window.SHROOMS_PACKED[{json.dumps(key)}]={json.dumps(base64.b64encode(gzip.compress(json.dumps(value,separators=(",",":" )).encode(),mtime=0)).decode())};\n')
index=unpack('regions/ch/index');cells={c['id']:c for c in index['cells']}
with rasterio.open(ROOT/'.cache/tlm3d-forest25.tif') as ds:mask=ds.read(1);affine=ds.transform
project=Transformer.from_crs(2056,4326,always_xy=True).transform
manifest={'metadata':{'source':'swissTLM3D 2026-02 forest mask','maskResolutionMeters':25,'simplificationMeters':15,'scoreResolutionMeters':500,'limits':'Forest outlines clipped to existing overview cells; colors are overview estimates, not 25 m scores.'},'tiles':[]}
total=0
for tile in index['tiles']:
 output=[]
 for old in unpack(tile['key']):
  c=cells[old['id']];x,y=c['x'],c['y'];col,row=~affine*(x-250,y+250);col,row=int(round(col)),int(round(row))
  patch=mask[max(0,row):row+20,max(0,col):col+20]
  if patch.shape!=(20,20):continue
  polygons=[]
  for geom,value in shapes(patch,mask=patch.astype(bool),transform=affine*Affine.translation(col,row)):
   g=shape(geom).simplify(15,preserve_topology=True).intersection(box(x-250,y-250,x+250,y+250))
   if g.is_empty:continue
   projected=mapping(transform(project,g))
   if projected['type']=='Polygon':polygons.append(projected['coordinates'])
   elif projected['type']=='MultiPolygon':polygons.extend(projected['coordinates'])
  if polygons:output.append({'id':c['id'],'geometry':{'type':'MultiPolygon','coordinates':[[[[round(a,6),round(b,6)] for a,b in ring] for ring in poly] for poly in polygons]}})
 key=tile['key'].replace('regions/ch/tiles/','overview-forest/tiles/');pack(key,output);total+=len(output)
 manifest['tiles'].append({'key':key,'bounds':tile['bounds']})
pack('overview-forest/index',manifest)
print(f'{total} forest-shaped overview cells in {len(manifest["tiles"])} bundles',flush=True)
# Group neighbouring files to avoid hundreds of requests in the Swiss overview.
# The national view uses a coarser outline; nearby views retain the 15 m simplification.
from collections import defaultdict
from shapely.ops import transform as geom_transform
inverse=Transformer.from_crs(4326,2056,always_xy=True).transform
groups=defaultdict(list)
for tile in manifest['tiles']:
 row,col=map(int,tile['key'].split('/')[-1].split('-'));groups[(row//5,col//5)].extend(unpack(tile['key']))
oldkeys=[t['key'] for t in manifest['tiles']];manifest['tiles']=[]
for (row,col),features in groups.items():
 key=f'overview-forest/chunks/{row}-{col}';coarsekey=f'overview-forest/coarse/{row}-{col}';coarse=[]
 bounds=[[90,180],[-90,-180]]
 for feature in features:
  for poly in feature['geometry']['coordinates']:
   for ring in poly:
    for lon,lat in ring:bounds[0][0]=min(bounds[0][0],lat);bounds[0][1]=min(bounds[0][1],lon);bounds[1][0]=max(bounds[1][0],lat);bounds[1][1]=max(bounds[1][1],lon)
  g=geom_transform(project,geom_transform(inverse,shape(feature['geometry'])).simplify(100,preserve_topology=True));coords=mapping(g)['coordinates'];coords=[coords] if g.geom_type=='Polygon' else coords
  coarse.append({'id':feature['id'],'geometry':{'type':'MultiPolygon','coordinates':[[[[round(a,5),round(b,5)] for a,b in ring] for ring in poly] for poly in coords]}})
 pack(key,features);pack(coarsekey,coarse);manifest['tiles'].append({'key':key,'coarseKey':coarsekey,'bounds':bounds})
manifest['metadata']['nationalSimplificationMeters']=100
pack('overview-forest/index',manifest)
for key in oldkeys:(ROOT/'data'/f'{key}.js').unlink()
print(f'Grouped into {len(groups)} bundles at each of two outline resolutions',flush=True)
