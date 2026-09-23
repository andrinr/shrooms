"""Prepare a partial national protection overlay from swissTLMRegio plus GIS-ZH."""
import sqlite3,json,gzip,base64
from pathlib import Path
from shapely import wkb
from shapely.geometry import mapping
from shapely.ops import transform,unary_union
from pyproj import Transformer
from pack_habitat import write_chunk
ROOT=Path(__file__).resolve().parents[1]
db=sqlite3.connect(ROOT/'.cache/swiss-tlm/swissTLMRegio_Product_LV95.gpkg');db.row_factory=sqlite3.Row
project=Transformer.from_crs(2056,4326,always_xy=True).transform
boundarydb=sqlite3.connect(ROOT/'.cache/swiss-tlm/swissTLMRegio_BOUNDARIES_LV95.gpkg')
boundaries=[]
for (blob,) in boundarydb.execute("select geom from swisstlmregio_landesgebiet where icc='CH'"):
 boundaries.append(wkb.loads(blob[8+[0,32,48,48,64][(blob[3]>>1)&7]:]))
country=unary_union(boundaries)
features=[]
for row in db.execute('select * from tlmregio_miscellaneous_protectedarea'):
 p=dict(row);blob=p['geom'];offset=8+[0,32,48,48,64][(blob[3]>>1)&7];g=wkb.loads(blob[offset:]);
 if g.geom_type not in ['Polygon','MultiPolygon']:continue
 g=g.intersection(country)
 if g.geom_type=='GeometryCollection':g=unary_union([part for part in g.geoms if part.geom_type in ['Polygon','MultiPolygon']])
 if g.is_empty or g.geom_type not in ['Polygon','MultiPolygon']:continue
 features.append({'type':'Feature','properties':{'id':p['uuid'],'name':p.get('namn') or p.get('namn1') or 'Mapped protected area','source':'© swisstopo swissTLMRegio 2026'},'geometry':mapping(transform(project,g.simplify(40)))})
s=(ROOT/'data/protected.js').read_text();zh=json.loads(gzip.decompress(base64.b64decode(json.loads(s.split('=',1)[1].strip().rstrip(';')))))
for f in zh['features']:f['properties']['source']='GIS-ZH forest reserves'
features+=zh['features'];write_chunk('national-protected',{'type':'FeatureCollection','features':features,'metadata':{'coverage':'Partial: swissTLMRegio protected areas plus GIS-ZH forest reserves. Not a complete inventory or a collection-permission map.'}})
print(len(features),'protected features')
