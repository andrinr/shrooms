"""Build an offline SVG basemap from the cached official municipality boundaries.
Run with .venv/bin/python scripts/build_basemap.py after downloading habitat sources.
SVG coordinates use Web Mercator to align exactly with Leaflet's default projection.
"""
import json, hashlib, argparse, subprocess, datetime
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape, LineString, Point
from shapely.ops import transform, unary_union
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--download',action='store_true')
if parser.parse_args().download:
 subprocess.run(['curl','--fail','--silent','--show-error','--max-time','120','--data-urlencode',f'data@{ROOT}/scripts/basemap.overpass','https://overpass.osm.ch/api/interpreter','-o',str(ROOT/'.cache/basemap-osm.json')],check=True)
osm_path=ROOT/'.cache/basemap-osm.json'
osm=json.loads(osm_path.read_text())
assert not osm.get('remark'), 'Overpass reported incomplete data'
assert len(osm.get('elements',[]))>100, 'Map source is unexpectedly small'
source=json.loads((ROOT/'.cache/municipalities.json').read_text())
project=Transformer.from_crs(2056,3857,always_xy=True).transform
wgs=Transformer.from_crs(3857,4326,always_xy=True).transform
features=[(f['properties'],transform(project,shape(f['geometry'])).simplify(35,preserve_topology=True)) for f in source['features']]
minx,miny,maxx,maxy=unary_union([g for _,g in features]).bounds
width=1200;scale=width/(maxx-minx);height=(maxy-miny)*scale

def path(g):
 polygons=[g] if g.geom_type=='Polygon' else list(g.geoms)
 parts=[]
 for polygon in polygons:
  for ring in [polygon.exterior,*polygon.interiors]:
   points=[((x-minx)*scale,(maxy-y)*scale) for x,y in ring.coords]
   parts.append('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in points)+'Z')
 return ''.join(parts)

svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height:.3f}"><title>Canton of Zürich roads, rivers and municipality boundaries</title><desc>GIS-ZH boundaries; roads and rivers © OpenStreetMap contributors. Simplified for orientation, not a trail map.</desc>']
labels=[]
major={'Zürich','Winterthur','Uster','Bülach','Dielsdorf','Andelfingen','Pfäffikon','Hinwil','Meilen','Horgen','Affoltern am Albis','Dietikon'}
for p,g in features:
 water=p.get('art_code')==3
 svg.append(f'<path d="{path(g)}" fill="{"#cadfdf" if water else "#efeddf"}" fill-rule="evenodd" stroke="#c1b8c3" stroke-width="0.7"/>')
 if p.get('gemeindename'):
  point=g.representative_point();lon,lat=wgs(point.x,point.y)
  labels.append({'name':p['gemeindename'],'lat':round(lat,6),'lon':round(lon,6),'major':p['gemeindename'] in major})
# Public OSM geometry is projected and clipped to canton territory at build time.
footprint=unary_union([g for _,g in features])
from_wgs=Transformer.from_crs(4326,3857,always_xy=True).transform
roads={key:[] for key in ['river','tertiary','secondary','primary','trunk','motorway']}
places=[]
for element in osm['elements']:
 tags=element.get('tags',{})
 if element['type']=='node' and tags.get('name'):
  point=Point(from_wgs(element['lon'],element['lat']))
  if footprint.covers(point):
   kind=tags['place']
   places.append({'name':tags['name'],'lat':element['lat'],'lon':element['lon'],'kind':kind,'minZoom':{'city':8,'town':9,'village':10,'hamlet':12}[kind]})
 elif element['type']=='way' and len(element.get('geometry',[]))>1:
  kind='river' if tags.get('waterway')=='river' else tags.get('highway')
  if kind not in roads:continue
  line=LineString([from_wgs(p['lon'],p['lat']) for p in element['geometry']]).simplify(15).intersection(footprint)
  parts=[line] if line.geom_type=='LineString' else list(getattr(line,'geoms',[]))
  for part in parts:
   if part.geom_type!='LineString' or part.is_empty:continue
   roads[kind].append('M'+'L'.join(f'{(x-minx)*scale:.2f},{(maxy-y)*scale:.2f}' for x,y in part.coords))
styles={'river':('#9bbfc8',1.6),'tertiary':('#ffffff',1.2),'secondary':('#d8c1a0',1.6),'primary':('#cba77c',2),'trunk':('#b08a78',2.6),'motorway':('#a57d83',3.2)}
for kind,segments in roads.items():
 color,weight=styles[kind]
 svg.append(f'<g id="{kind}" fill="none" stroke="{color}" stroke-width="{weight}" stroke-linecap="round" stroke-linejoin="round">')
 svg.append('<path d="'+' '.join(segments)+'"/>')
 svg.append('</g>')
# Replace area-centroid labels with actual OSM place points.
assert len(places)>150 and len(roads['motorway'])>50, 'Missing roads or settlements'
labels=sorted(places,key=lambda p:(p['minZoom'],p['name']))
svg.append('</svg>')
(ROOT/'data/basemap.svg').write_text(''.join(svg))
west,south=wgs(minx,miny);east,north=wgs(maxx,maxy)
metadata={'bounds':[[south,west],[north,east]],'labels':labels,'source':'GIS-ZH boundaries; © OpenStreetMap contributors roads, rivers and places','osmLicense':'ODbL-1.0','osmEndpoint':'https://overpass.osm.ch/api/interpreter','osmBaseVersion':osm.get('osm3s',{}).get('timestamp_osm_base'),'osmRetrieved':datetime.datetime.fromtimestamp(osm_path.stat().st_mtime,datetime.timezone.utc).isoformat(),'osmSha256':hashlib.sha256(osm_path.read_bytes()).hexdigest(),'roadSegments':{k:len(v) for k,v in roads.items()},'simplificationMeters':35,'projection':'EPSG:3857'}
(ROOT/'data/basemap.js').write_text('window.SHROOMS_BASEMAP='+json.dumps(metadata,ensure_ascii=False,separators=(',',':'))+';\n')
print(f'Bundled basemap: {(ROOT/"data/basemap.svg").stat().st_size:,} bytes, {len(labels)} place labels')
