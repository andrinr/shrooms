"""Build 50 m local forest cells using swissTLM3D boundaries (25 m mask).
Zürich retains its richer stand survey. Terrain remains explicitly 200 m.
Run download_tlm3d.py first; existing national preparation inputs are required.
"""
import base64,collections,gzip,json,sqlite3,hashlib,logging,math
from pathlib import Path
import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.transform import Affine
from rasterio.windows import Window
from rasterio.warp import reproject,Resampling
import shapefile
from shapely import wkb
from pyproj import Transformer
from pack_habitat import write_chunk
from download_tlm3d import URL
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache'
ORIGIN=(2480000,1300000);DIMS=(4600,7200);STEP=50;TILE=100
CODES=['','zh','be','lu','ur','sz','ow','nw','gl','zg','fr','so','bs','bl','sh','ar','ai','sg','gr','ag','tg','ti','vd','vs','ne','ge','ju']
def unpack(key):
 text=(ROOT/'data'/f'{key}.js').read_text();return json.loads(gzip.decompress(base64.b64decode(json.loads(text.split('=',1)[1].strip().rstrip(';')))))
def geom(blob):return wkb.loads(blob[8+[0,32,48,48,64][(blob[3]>>1)&7]:])
affine=Affine(50,0,ORIGIN[0],0,-50,ORIGIN[1]);fine=Affine(25,0,ORIGIN[0],0,-25,ORIGIN[1])
maskfile=CACHE/'tlm3d-forest25.tif'
if maskfile.exists():
 with rasterio.open(maskfile) as ds:mask=ds.read(1)
else:
 mask=np.zeros((DIMS[0]*2,DIMS[1]*2),dtype='uint8')
 logging.getLogger('shapefile').setLevel(logging.ERROR)
 for source in sorted((CACHE/'tlm3d').glob('*.shp')):
  reader=shapefile.Reader(str(source),encoding='utf-8');n=0
  for record in reader.iterRecords(fields=['OBJEKTART']):
   if record['OBJEKTART'] not in ['Wald','Wald offen']:continue
   feature=reader.shape(record.oid);x0,y0,x1,y1=feature.bbox
   c0=max(0,int((x0-ORIGIN[0])//25));c1=min(mask.shape[1],math.ceil((x1-ORIGIN[0])/25))
   r0=max(0,int((ORIGIN[1]-y1)//25));r1=min(mask.shape[0],math.ceil((ORIGIN[1]-y0)/25))
   if c1<=c0 or r1<=r0:continue
   patch=rasterize([(feature.__geo_interface__,1)],out_shape=(r1-r0,c1-c0),transform=fine*Affine.translation(c0,r0),dtype='uint8')
   mask[r0:r1,c0:c1]|=patch;n+=1
  print(source.name,n,'forest polygons',flush=True)
 with rasterio.open(maskfile,'w',driver='GTiff',width=mask.shape[1],height=mask.shape[0],count=1,dtype='uint8',crs='EPSG:2056',transform=fine,compress='deflate') as ds:ds.write(mask,1)
print('Loading administrative boundaries and terrain',flush=True)
db=sqlite3.connect(CACHE/'swiss-tlm/swissTLMRegio_BOUNDARIES_LV95.gpkg');db.row_factory=sqlite3.Row
municipalities=[(dict(row),geom(row['geom'])) for row in db.execute("SELECT * FROM swisstlmregio_hoheitsgebiet WHERE icc='CH'")]
muni=rasterize([(g,i+1) for i,(_,g) in enumerate(municipalities)],out_shape=DIMS,transform=affine,dtype='int16')
terrainfile=CACHE/'tlm3d-terrain50.npz'
if terrainfile.exists():
 cached=np.load(terrainfile);elevation=cached['elevation'];slope=cached['slope'];aspect=cached['aspect']
else:
 with rasterio.open(next((CACHE/'swiss-dem').rglob('*.asc'))) as ds:
  raw=ds.read(1).astype(float);raw[raw==ds.nodata]=np.nan;sy,sx=np.gradient(raw,200,200);angles=np.arctan2(-sx,sy)
  def warp(values):
   result=np.full(DIMS,np.nan,dtype='float32');reproject(values,result,src_transform=ds.transform,src_crs=ds.crs or 'EPSG:21781',dst_transform=affine,dst_crs='EPSG:2056',src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.bilinear);return result
  elevation=warp(raw);slope=warp(np.degrees(np.arctan(np.hypot(sx,sy))));aspect=(np.degrees(np.arctan2(warp(np.sin(angles)),warp(np.cos(angles))))+360)%360
 np.savez_compressed(terrainfile,elevation=elevation,slope=slope,aspect=aspect)
project=Transformer.from_crs(2056,4326,always_xy=True)
manifest=unpack('habitat/index');oldtiles=manifest['tiles'];manifest['tiles']=[t for t in oldtiles if t['region']=='zh']
counts=collections.Counter();totalbytes=0
# Bits retain the four 25 m forest pixels inside each 50 m score cell.
bits=mask[0::2,0::2]+2*mask[0::2,1::2]+4*mask[1::2,0::2]+8*mask[1::2,1::2]
del mask
def checksum(path):
 digest=hashlib.sha256()
 with open(path,'rb') as source:
  for block in iter(lambda:source.read(1024*1024),b''):digest.update(block)
 return digest.hexdigest()
source_manifest={'product':'swissTLM3D 2026-02','url':URL,'license':'swisstopo open-data terms','files':[{'name':p.name,'sha256':checksum(p),'bytes':p.stat().st_size} for p in sorted((CACHE/'tlm3d').iterdir()) if p.suffix.lower() in ['.shp','.shx','.dbf','.prj','.cpg']]}
(ROOT/'data/detailed-forest-sources.json').write_text(json.dumps(source_manifest,indent=2)+'\n')
metadata={'cellSizeMeters':50,'maskResolutionMeters':25,'terrainResolutionMeters':200,'forestSource':'swissTLM3D 2026-02','forestClasses':['Wald','Wald offen'],'forestDownload':URL,'treeSource':'FOEN / WSL NFI forest mix 2023, 10 m','limits':'Forest mask 25 m; score grid 50 m; terrain source remains 200 m. No individual host-tree shares or canopy measurements.'}
# Project grid corners once per tile, rather than making a transformer per cell.
with rasterio.open(CACHE/'swiss-mix.tif') as mix:
 for tr in range(0,DIMS[0],TILE):
  for tc in range(0,DIMS[1],TILE):
   block=bits[tr:tr+TILE,tc:tc+TILE];admin=muni[tr:tr+TILE,tc:tc+TILE]
   positions=np.argwhere((block>0)&(admin>0))
   if not len(positions):continue
   tree=mix.read(1,window=Window(tc*5,tr*5,TILE*5,TILE*5),out_shape=(TILE,TILE),resampling=Resampling.average,masked=True)
   xx,yy=np.meshgrid(ORIGIN[0]+(tc*2+np.arange(201))*25,ORIGIN[1]-(tr*2+np.arange(201))*25)
   lons,lats=project.transform(xx,yy);groups=collections.defaultdict(list)
   for rr,cc in positions:
    r,c=tr+int(rr),tc+int(cc);p=municipalities[int(admin[rr,cc])-1][0];code=CODES[int(p['kantonsnummer'][2:4])]
    if code=='zh':continue
    coverage=int(block[rr,cc]);pixels=bin(coverage).count("1");key=f'habitat/tiles/{code}/tlm50-{tr//TILE}-{tc//TILE}'
    x,y=ORIGIN[0]+c*50+25,ORIGIN[1]-r*50-25
    lon,lat=float(lons[rr*2+1,cc*2+1]),float(lats[rr*2+1,cc*2+1]);v=tree[rr,cc];broad=None if np.ma.is_masked(v) or not 0<=v<=100 else round(float(v),1)
    def value(a):return round(float(a[r,c]),1) if np.isfinite(a[r,c]) else None
    cell={'id':f'{code}:tlm50-{r}-{c}','sourceId':f'tlm50-{r}-{c}','region':code,'name':p['name'],'district':code.upper(),'lat':round(lat,5),'lon':round(lon,5),'x':x,'y':y,'forest':pixels*25,'area':pixels*.0625,'reservePercent':None,'canopy':None,'canopyKnown':0,'broadleaf':broad,'conifer':None if broad is None else round(100-broad,1),'treeKnown':0 if broad is None else 1,'beech':None,'oak':None,'spruce':None,'fir':None,'pine':None,'slope':value(slope),'aspect':value(aspect),'elevation':value(elevation),'yearMin':2023,'yearMax':2023,'forestSource':metadata['forestSource'],'tile':key,'cellSizeMeters':50,'terrainResolutionMeters':200,'maskResolutionMeters':25}
    def ring(dr,dc,width):
     a,b=int(rr)*2+dr,int(cc)*2+dc
     return [[round(float(lons[i,j]),5),round(float(lats[i,j]),5)] for i,j in [(a,b),(a,b+width),(a+width,b+width),(a+width,b),(a,b)]]
    if coverage==15:geometry={'type':'Polygon','coordinates':[ring(0,0,2)]}
    else:geometry={'type':'MultiPolygon','coordinates':[[ring(dr,dc,1)] for n,(dr,dc) in enumerate([(0,0),(0,1),(1,0),(1,1)]) if coverage&(1<<n)]}
    groups[code].append({'type':'Feature','geometry':geometry,'properties':cell})
   for code,features in groups.items():
    key=features[0]['properties']['tile'];totalbytes+=write_chunk(key,features);counts[code]+=len(features)
    bounds=[[round(float(lats.min()),5),round(float(lons.min()),5)],[round(float(lats.max()),5),round(float(lons.max()),5)]]
    manifest['tiles'].append({'key':key,'bounds':bounds,'count':len(features),'region':code})
  if tr%500==0:print('Rows',tr,'cells',sum(counts.values()),flush=True)
for region in manifest['regions']:
 if region['id']!='zh':region['metadata']={**region['metadata'],**metadata,'cellCount':counts[region['id']]}
manifest['metadata']=metadata
write_chunk('habitat/index',manifest)
# Old regional API bundles remain; replace only the superseded seamless tiles.
newkeys={t['key'] for t in manifest['tiles']}
for tile in oldtiles:
 if tile['key'] not in newkeys:(ROOT/'data'/f"{tile['key']}.js").unlink(missing_ok=True)
print('Detailed cells:',dict(counts),'bytes:',totalbytes,flush=True)
