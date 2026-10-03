#!/usr/bin/env python3
"""把 Natural Earth（公有領域）的海岸線、河流、湖、城市整理成畫面用的 data/geo.json。
    python3 tools/prep_geo.py
陸地的「點」：在球面上均勻撒點（Fibonacci 排列），落在陸地上的留下來。全球一份（疏）、舊大陸一份（密）。
"""
import base64, json, os
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
GEO = os.path.join(HERE, '..', 'data', 'geo')
load = lambda n: json.load(open(os.path.join(GEO, n + '.geojson')))

def rings_of(fc):
    out = []
    for f in fc['features']:
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for p in polys:
            out.append([np.asarray(r, dtype=float)[:, :2] for r in p])   # [外環, 洞...]
    return out

def mask_from(polys, lakes, W=7200):
    H = W // 2
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    px = lambda r: [((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y in r]
    for p in polys:
        d.polygon(px(p[0]), fill=255)
        for hole in p[1:]:
            d.polygon(px(hole), fill=0)
    for p in lakes:
        if len(p[0]) > 12:
            d.polygon(px(p[0]), fill=0)
    return np.asarray(im) > 0

def fib(n):
    i = np.arange(n) + 0.5
    lat = np.degrees(np.arcsin(1 - 2 * i / n))
    lon = (np.degrees(i * np.pi * (3 - np.sqrt(5))) % 360) - 180
    return lon, lat

def on_land(mask, lon, lat):
    H, W = mask.shape
    x = np.clip(((lon + 180) / 360 * W).astype(int), 0, W - 1)
    y = np.clip(((90 - lat) / 180 * H).astype(int), 0, H - 1)
    return mask[y, x]

def pack(lon, lat):
    a = np.stack([np.round(lon * 100), np.round(lat * 100)], axis=1).astype('<i2')
    return base64.b64encode(a.tobytes()).decode()

def q(r, nd=2):
    return [[round(float(x), nd), round(float(y), nd)] for x, y in r]

land50, land110 = rings_of(load('ne_50m_land')), rings_of(load('ne_110m_land'))
lakes50, lakes110 = rings_of(load('ne_50m_lakes')), rings_of(load('ne_110m_lakes'))
mask = mask_from(land50, lakes50)

lon, lat = fib(220000)
m = on_land(mask, lon, lat)
dots_global = pack(lon[m], lat[m]); n_global = int(m.sum())

lon, lat = fib(2600000)                                  # 舊大陸的密點：歐亞非
w = (lon > -25) & (lon < 125) & (lat > -12) & (lat < 66)
lon, lat = lon[w], lat[w]
m = on_land(mask, lon, lat)
dots_region = pack(lon[m], lat[m]); n_region = int(m.sum())

rivers = []
for f in load('ne_50m_rivers_lake_centerlines')['features']:
    g, p = f['geometry'], f['properties']
    if not g: continue
    lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for ln in lines:
        rivers.append(dict(name=p.get('name') or '', rank=p.get('scalerank', 9), pts=q([c[:2] for c in ln])))

cities = []
for f in load('ne_50m_populated_places_simple')['features']:
    p = f['properties']; x, y = f['geometry']['coordinates'][:2]
    cities.append([round(x, 2), round(y, 2), int(p.get('pop_max') or 0), p.get('name') or ''])
cities.sort(key=lambda c: -c[2])

doc = dict(
    coast110=[q(p[0]) for p in land110],
    coast50=[q(p[0]) for p in land50 if len(p[0]) >= 8],
    lakes50=[q(p[0]) for p in lakes50 if len(p[0]) >= 14],
    rivers=rivers, cities=cities,
    dots_global=dots_global, dots_region=dots_region,
    credit='Natural Earth（公有領域）naturalearthdata.com',
)
out = os.path.join(HERE, '..', 'data', 'geo.json')
json.dump(doc, open(out, 'w'), separators=(',', ':'), ensure_ascii=False)
print(f'{out}  {os.path.getsize(out)/1e6:.2f} MB；全球點 {n_global}、舊大陸密點 {n_region}、海岸環 {len(doc["coast50"])}、河 {len(rivers)}、城市 {len(cities)}')
print('兩河：', sorted({r['name'] for r in rivers if r['name'] in ('Tigris', 'Euphrates', 'Nile', 'Indus', 'Huang', 'Chang Jiang', 'Ganges', 'Danube')}))
