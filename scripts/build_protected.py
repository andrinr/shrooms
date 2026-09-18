"""Bundle explicitly marked forest reserves from cached GIS-ZH source polygons."""
import json, collections, hashlib
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, transform
from pyproj import Transformer
from pack_habitat import write_chunk
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'.cache/reserves.json'
raw=json.loads(source.read_text())
assert len(raw['features'])==raw['numberMatched'], 'Incomplete reserve source'
municipalities=json.loads((ROOT/'.cache/municipalities.json').read_text())
boundary=unary_union([shape(f['geometry']) for f in municipalities['features']])
groups=collections.defaultdict(list)
names={}
for f in raw['features']:
 p=f['properties'];key=p['waldreservatnummer']
 groups[key].append(shape(f['geometry']));names[key]=p.get('waldreservatname') or key
project=Transformer.from_crs(2056,4326,always_xy=True).transform
features=[]
for key,parts in groups.items():
 geom=unary_union(parts).intersection(boundary).simplify(5,preserve_topology=True)
 if geom.is_empty:continue
 features.append({'type':'Feature','properties':{'id':key,'name':names[key],'kind':'Forest reserve'},'geometry':mapping(transform(project,geom))})
result={'type':'FeatureCollection','features':features,'metadata':{'source':'GIS-ZH Waldreservate','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceFeatureCount':len(raw['features']),'reserveCount':len(features),'simplificationMeters':5,'coverage':'Mapped forest reserves only; other protected areas and local restrictions are not comprehensively mapped.'}}
size=write_chunk('protected',result)
print(f'{len(features)} reserves; {size:,} compressed bytes')
