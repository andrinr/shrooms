"""Download pinned official nationwide sources; raw files stay outside deployments."""
import subprocess,zipfile,hashlib,json,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache';CACHE.mkdir(exist_ok=True)
sources={
 'swiss-tlm.zip':'https://data.geo.admin.ch/ch.swisstopo.swisstlmregio/swisstlmregio_2026/swisstlmregio_2026_2056.gpkg.zip',
 'swiss-mix.tif':'https://data.geo.admin.ch/ch.bafu.landesforstinventar-waldmischungsgrad/landesforstinventar-waldmischungsgrad/landesforstinventar-waldmischungsgrad_2056.tif',
 'swiss-dem.zip':'https://data.geo.admin.ch/ch.swisstopo.digitales-hoehenmodell_25/data.zip'
}
for name,url in sources.items():
 target=CACHE/name;temporary=CACHE/(name+'.download')
 subprocess.run(['curl','--fail','--location','--silent','--show-error','--retry','2','--max-time','600',url,'-o',str(temporary)],check=True)
 if name=='swiss-tlm.zip':assert hashlib.sha256(temporary.read_bytes()).hexdigest()=='e3920b54d747677618090addd071a5260208f4b00cd41ecc17d5e50dd2da7a12'
 if name=='swiss-mix.tif':assert hashlib.sha256(temporary.read_bytes()).hexdigest()=='492e9156a721954bda79d4288320ddb824eb4534f3aaa0f9dbbaf65d9ba75d62'
 if name=='swiss-dem.zip':assert hashlib.sha256(temporary.read_bytes()).hexdigest()=='9d283f198f829202e09859954d54553001f7ff1a79e3614ad47ac9cd98641887'
 temporary.replace(target)
 if name.endswith('.zip'):
  with zipfile.ZipFile(target) as archive:archive.extractall(CACHE/name.removesuffix('.zip'))
print('Sources downloaded. Run build_switzerland.py, then build_national_protected.py.')

manifest=json.loads((ROOT/'data/national-sources.json').read_text())
manifest['retrieved']=datetime.date.today().isoformat()
for item in manifest['sources']:
 item['sha256']=hashlib.sha256((CACHE/item['file']).read_bytes()).hexdigest()
(ROOT/'data/national-sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
