import math, os, subprocess, json, heapq, io
import mapbox_vector_tile
from PIL import Image, ImageDraw, ImageFont

D = os.path.dirname(os.path.abspath(__file__))
TD = os.path.join(D, 'tiles')
Z = 14


def ll2t(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def t2ll(x, y, z):
    n = 2 ** z
    lon = x / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lon


def fetch(path):
    f = os.path.join(TD, path.replace('/', '_'))
    if not os.path.exists(f):
        subprocess.run(['curl', '-sSf', '--max-time', '30', '-o', f, 'https://cyberjapandata.gsi.go.jp/xyz/' + path], check=False)
    return f if os.path.exists(f) else None


_roads = {}


def roads(tx, ty):
    k = (tx, ty)
    if k in _roads:
        return _roads[k]
    f = fetch(f'optimal_bvmap-v1/{Z}/{tx}/{ty}.pbf')
    out = []
    if f:
        d = mapbox_vector_tile.decode(open(f, 'rb').read(), default_options={'y_coord_down': True})
        L = d.get('RdCL')
        if L:
            ext = L.get('extent', 4096)
            for ft in L['features']:
                g = ft['geometry']
                lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates'] if g['type'] == 'MultiLineString' else []
                for ln in lines:
                    pts = [t2ll(tx + x / ext, ty + y / ext, Z) for x, y in ln]
                    out.append((pts, ft['properties']))
    _roads[k] = out
    return out


def hav(a, b):
    R = 6371008.8
    la1, la2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def tiles_for(bbox):
    (s, w, n, e) = bbox
    x0, y1 = ll2t(s, w, Z)
    x1, y0 = ll2t(n, e, Z)
    return [(x, y) for x in range(int(x0), int(x1) + 1) for y in range(int(y0), int(y1) + 1)]


def build(bbox, keep):
    """keep(props) -> cost factor or None"""
    G = {}
    key = lambda p: (round(p[0] / 2e-5), round(p[1] / 2e-5))
    pos = {}
    ends = []
    for t in tiles_for(bbox):
        for pts, pr in roads(*t):
            f = keep(pr)
            if f is None:
                continue
            ks = [key(p) for p in pts]
            for p, k in zip(pts, ks):
                pos[k] = p
            for a, b, pa, pb in zip(ks, ks[1:], pts, pts[1:]):
                if a == b:
                    continue
                w = hav(pa, pb) * f
                G.setdefault(a, {})[b] = min(w, G.get(a, {}).get(b, 1e18))
                G.setdefault(b, {})[a] = min(w, G.get(b, {}).get(a, 1e18))
            ends += [ks[0], ks[-1]]
    # つなぎ：タイルの境目で切れた線の端を、近くの点につなぐ
    grid = {}
    for k, p in pos.items():
        grid.setdefault((round(p[0] / 3e-4), round(p[1] / 3e-4)), []).append(k)
    for e in set(ends):
        if len(G.get(e, {})) > 1:
            continue
        p = pos[e]
        gk = (round(p[0] / 3e-4), round(p[1] / 3e-4))
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for k in grid.get((gk[0] + dx, gk[1] + dy), []):
                    if k == e or k in G.get(e, {}):
                        continue
                    d = hav(p, pos[k])
                    if d < 12 and (best is None or d < best[0]):
                        best = (d, k)
        if best:
            G.setdefault(e, {})[best[1]] = best[0] + 1
            G.setdefault(best[1], {})[e] = best[0] + 1
    return G, pos


def nearest(G, pos, p):
    return min((k for k in G), key=lambda k: hav(p, pos[k]))


def dijkstra(G, s, t):
    dist = {s: 0}
    prev = {}
    q = [(0, s)]
    while q:
        d, u = heapq.heappop(q)
        if u == t:
            break
        if d > dist[u]:
            continue
        for v, w in G[u].items():
            nd = d + w
            if nd < dist.get(v, 1e18):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(q, (nd, v))
    if t not in dist:
        return None
    path = [t]
    while path[-1] != s:
        path.append(prev[path[-1]])
    return path[::-1]


def render(bbox, lines=(), points=(), z=13, out='out.png', base='pale', motorways=False):
    (s, w, n, e) = bbox
    x0, y1 = ll2t(s, w, z)
    x1, y0 = ll2t(n, e, z)
    W, H = int((x1 - x0) * 256), int((y1 - y0) * 256)
    im = Image.new('RGB', (W, H), 'white')
    for tx in range(int(x0), int(x1) + 1):
        for ty in range(int(y0), int(y1) + 1):
            f = fetch(f'{base}/{z}/{tx}/{ty}.png')
            if f:
                try:
                    t = Image.open(f).convert('RGB')
                    im.paste(t, (int((tx - x0) * 256), int((ty - y0) * 256)))
                except Exception:
                    pass
    dr = ImageDraw.Draw(im)
    P = lambda p: ((ll2t(p[0], p[1], z)[0] - x0) * 256, (ll2t(p[0], p[1], z)[1] - y0) * 256)
    if motorways:
        for t in tiles_for(bbox):
            for pts, pr in roads(*t):
                if pr.get('vt_motorway') == 1:
                    dr.line([P(p) for p in pts], fill=(0, 140, 60), width=2)
    for ln, col in lines:
        dr.line([P(p) for p in ln], fill=col, width=4)
    for p, lab in points:
        x, y = P(p)
        dr.ellipse([x - 5, y - 5, x + 5, y + 5], outline=(0, 0, 255), width=2)
        dr.text((x + 7, y - 7), lab, fill=(0, 0, 200))
    # 緯度経度の目盛り
    step = 0.01 if (e - w) < 0.2 else 0.05
    lo = math.ceil(w / step) * step
    while lo < e:
        x, _ = P((s, lo)); dr.line([(x, 0), (x, H)], fill=(200, 200, 255)); dr.text((x + 2, 2), f'{lo:.3f}', fill=(80, 80, 200)); lo += step
    la = math.ceil(s / step) * step
    while la < n:
        _, y = P((la, w)); dr.line([(0, y), (W, y)], fill=(200, 200, 255)); dr.text((2, y + 2), f'{la:.3f}', fill=(80, 80, 200)); la += step
    im.save(out)
    return out
