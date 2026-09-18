"""Losslessly pack habitat properties and 2 km geometry chunks for static hosting."""
import base64, gzip, json, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def write_chunk(key, value):
    payload = gzip.compress(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0)
    path = ROOT / 'data' / (key + '.js')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('window.SHROOMS_PACKED[' + json.dumps(key) + ']=' + json.dumps(base64.b64encode(payload).decode()) + ';\n')
    return path.stat().st_size

def pack(data):
    groups = collections.defaultdict(list)
    cells = []
    for f in data['features']:
        c = dict(f['properties'])
        row, col = map(int, c['id'].split('-'))
        c['tile'] = f'tiles/{row//40}-{col//40}'
        cells.append(c)
        groups[c['tile']].append({'id':c['id'], 'geometry':f['geometry']})
    # Remove obsolete tile layout after a grid-size change.
    for old in (ROOT / 'data' / 'tiles').glob('*.js'):
        old.unlink()
    tiles = []
    for key, items in sorted(groups.items()):
        def points(value):
            if isinstance(value[0], (int, float)): yield value
            else:
                for child in value: yield from points(child)
        coords = [p for item in items for p in points(item['geometry']['coordinates'])]
        bounds = [[min(p[1] for p in coords),min(p[0] for p in coords)], [max(p[1] for p in coords),max(p[0] for p in coords)]]
        tiles.append({'key':key,'bounds':bounds,'bytes':write_chunk(key,items),'count':len(items)})
    index = {'metadata':data['metadata'],'weatherPoints':data['weatherPoints'],'cells':cells,'tiles':tiles}
    size = write_chunk('index',index)
    print(f'Index {size:,} bytes; {len(tiles)} tiles, {sum(t["bytes"] for t in tiles):,} bytes total; largest {max(t["bytes"] for t in tiles):,} bytes')
    return index
if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Uncompressed habitat FeatureCollection JSON')
    pack(json.loads(parser.parse_args().source.read_text()))
