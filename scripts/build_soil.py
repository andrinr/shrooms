"""Pack WSL topsoil pH and its 90% prediction interval at the native 25 m grid.

Run with rasterio/numpy installed. Source ZIPs are public, CC BY-SA 4.0.
No interpolation or gap filling; round pH to 0.1 and preserve missing pixels.
"""
import base64
import hashlib
import json
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window
from pack_habitat import write_chunk

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'soil'
BASE = 'https://www.envidat.ch/dataset/9a0b1daa-a4e0-4c62-b348-ec23354105c6/resource/'
SOURCES = {
    'ph_maps.zip': BASE + '639353b5-92a5-43d1-b0ec-4ce8ca7773c0/download/ph_maps.zip',
    'ph_uncertainty_maps.zip': BASE + 'c5bea000-de46-4b93-8de8-f246c6135b9f/download/ph_uncertainty_maps.zip',
}

def build():
    CACHE.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        path = CACHE / name
        if not path.exists():
            urllib.request.urlretrieve(url, path)
        with zipfile.ZipFile(path) as archive:
            for member in archive.namelist():
                if '0_5' in member and member.endswith('.tif'):
                    archive.extract(member, CACHE)
    paths = ['pH_maps/pH_0_5.tif', 'pH_uncertainty_maps/pH_0_5_low05.tif', 'pH_uncertainty_maps/pH_0_5_up95.tif']
    rasters = [rasterio.open(CACHE / p) for p in paths]
    source = rasters[0]
    assert source.res == (25, 25) and source.crs.to_epsg() == 2056
    assert all(r.transform == source.transform and r.shape == source.shape for r in rasters)
    size = 256
    keys = []
    total = 0
    for row in range(0, source.height, size):
        for col in range(0, source.width, size):
            h, w = min(size, source.height-row), min(size, source.width-col)
            arrays = [r.read(1, window=Window(col, row, w, h), masked=True) for r in rasters]
            if arrays[0].count() == 0:
                continue
            encoded = np.full((size, size, 3), 255, dtype=np.uint8)
            for i, values in enumerate(arrays):
                valid = ~np.ma.getmaskarray(values)
                assert np.all((values[valid] >= 0) & (values[valid] <= 14))
                encoded[:h, :w, i][valid] = np.rint(values.data[valid]*10).astype(np.uint8)
            key = f'soil/tiles/{row//size}-{col//size}'
            total += write_chunk(key, {'values': base64.b64encode(encoded.tobytes()).decode()})
            keys.append(key)
    metadata = {
        'source': 'WSL / EnviDat, Baltensweiler et al. (2024)',
        'url': 'https://doi.org/10.16904/envidat.484',
        'license': 'CC BY-SA 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'property': 'pH (CaCl2)', 'depthCm': [0, 5], 'predictionInterval': 90,
        'resolutionMeters': 25, 'crs': 'EPSG:2056',
        'origin': [source.transform.c, source.transform.f],
        'width': source.width, 'height': source.height, 'tileSize': size,
        'channels': ['prediction', 'lower', 'upper'], 'scale': 10, 'noData': 255,
        'tiles': keys,
        'sources': [{'url': url, 'sha256': hashlib.sha256((CACHE/name).read_bytes()).hexdigest()} for name, url in SOURCES.items()],
    }
    write_chunk('soil/index', metadata)
    for r in rasters:
        r.close()
    print(f'{len(keys)} native-resolution soil tiles; {total:,} bytes')

if __name__ == '__main__':
    build()
