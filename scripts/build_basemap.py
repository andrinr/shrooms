"""Build an offline SVG basemap from the cached official municipality boundaries.
Run with .venv/bin/python scripts/build_basemap.py after downloading habitat sources.
SVG coordinates use Web Mercator to align exactly with Leaflet's default projection.
"""
import json
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union
ROOT=Path(__file__).resolve().parents[1]
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

svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height:.3f}"><title>Canton of Zürich municipality and lake boundaries</title><desc>GIS-ZH official municipality boundaries. Simplified for orientation, not a trail map.</desc>']
labels=[]
major={'Zürich','Winterthur','Uster','Bülach','Dielsdorf','Andelfingen','Pfäffikon','Hinwil','Meilen','Horgen','Affoltern am Albis','Dietikon'}
for p,g in features:
 water=p.get('art_code')==3
 svg.append(f'<path d="{path(g)}" fill="{"#cadfdf" if water else "#efeddf"}" fill-rule="evenodd" stroke="#c1b8c3" stroke-width="0.7"/>')
 if p.get('gemeindename'):
  point=g.representative_point();lon,lat=wgs(point.x,point.y)
  labels.append({'name':p['gemeindename'],'lat':round(lat,6),'lon':round(lon,6),'major':p['gemeindename'] in major})
svg.append('</svg>')
(ROOT/'data/basemap.svg').write_text(''.join(svg))
west,south=wgs(minx,miny);east,north=wgs(maxx,maxy)
metadata={'bounds':[[south,west],[north,east]],'labels':labels,'source':'GIS-ZH municipality boundaries','simplificationMeters':35,'projection':'EPSG:3857'}
(ROOT/'data/basemap.js').write_text('window.SHROOMS_BASEMAP='+json.dumps(metadata,ensure_ascii=False,separators=(',',':'))+';\n')
print(f'Bundled basemap: {(ROOT/"data/basemap.svg").stat().st_size:,} bytes, {len(labels)} municipality labels')
