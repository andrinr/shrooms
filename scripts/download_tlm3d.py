"""Download only detailed land-cover members of the official swissTLM3D ZIP.
HTTP range requests avoid unrelated transport, buildings and other layers.
"""
import io, json, urllib.request, zipfile, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
URL='https://data.geo.admin.ch/ch.swisstopo.swisstlm3d/swisstlm3d_2026-02/swisstlm3d_2026-02_2056_5728.shp.zip'
DEST=ROOT/'.cache/tlm3d';DEST.mkdir(parents=True,exist_ok=True)
class RemoteZip(io.RawIOBase):
 def __init__(self,url):
  self.url=url;self.pos=0
  with urllib.request.urlopen(urllib.request.Request(url,method='HEAD'),timeout=60) as response:self.length=int(response.headers['Content-Length'])
 def seek(self,offset,whence=0):
  self.pos=offset if whence==0 else self.pos+offset if whence==1 else self.length+offset
  return self.pos
 def tell(self):return self.pos
 def read(self,size=-1):
  size=self.length-self.pos if size<0 else min(size,self.length-self.pos)
  if not size:return b''
  req=urllib.request.Request(self.url,headers={'Range':f'bytes={self.pos}-{self.pos+size-1}'})
  with urllib.request.urlopen(req,timeout=120) as response:
   if response.status!=206:raise RuntimeError('Byte ranges are required')
   data=response.read()
  if len(data)!=size:raise RuntimeError('Incomplete range response')
  self.pos+=len(data);return data
if __name__=='__main__':
 with zipfile.ZipFile(RemoteZip(URL)) as archive:
  for info in archive.infolist():
   name=info.filename.replace('\\','/').split('/')[-1]
   if 'TLM_BODENBEDECKUNG_' not in name or Path(name).suffix.lower() not in ['.shp','.shx','.dbf','.prj','.cpg']:continue
   target=DEST/name
   if target.exists() and target.stat().st_size==info.file_size:continue
   print('Extracting',name,info.file_size,flush=True)
   with archive.open(info) as source,open(str(target)+'.download','wb') as out:shutil.copyfileobj(source,out,8*1024*1024)
   Path(str(target)+'.download').replace(target)
 print('Detailed land cover ready',flush=True)
