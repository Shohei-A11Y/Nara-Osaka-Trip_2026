#!/usr/bin/env python3
"""リレーかもめ（博多〜武雄温泉）の線路の形・駅の位置・市町村の境目・トンネルを作る道具。

  出典
  - 線路の形・トンネル・駅の位置：© OpenStreetMap contributors（ODbL）。
    Overture Maps Foundation 配布データ（release 2026-09-23.0）の transportation/segment（subtype=rail）と
    base/infrastructure（class=railway_station）から抜き出す（山陽新幹線の線路と同じ出どころ）。
  - 市町村：国土交通省 国土数値情報「行政区域データ 2025年版」（CC BY 4.0）を加工したもの
    （npm: japan-choropleth の data/geojson/municipalities.geojson）。

  使い方（リポジトリの一番上で）
    pip install pyarrow shapely
    npm pack japan-choropleth && tar xzf japan-choropleth-*.tgz   # → package/data/geojson/municipalities.geojson
    python3 tools/make-relay-line.py --muni package/data/geojson/municipalities.geojson
  → assets/line-relay.json を書き、line-data.js に貼る stations・munis・tunnels を表示する。
    Overture から抜き出したものは --cache のフォルダに置き、2回目からはそれを使う。

  km は博多の少し北（博多駅の0.3km手前）を0とした、線路の形の実測長（livemap.js と同じ計算）。
  経路は 吉塚 → 博多 → 鳥栖 → 江北 → 武雄温泉 → 永尾 の順に、鉄道の線をたどった最短の道（新幹線・西鉄・地下鉄・廃線は除き、
  鹿児島本線・長崎本線・佐世保線の名前の付いた線を優先）。長さは博多〜武雄温泉で営業キロ（28.6＋39.6＋13.7＝81.9km）とほぼ同じになる。
"""
import argparse, heapq, json, math, os, re, sys

R = 6371.0088
BBOX = (129.95, 130.60, 33.15, 33.65)   # 経度の西・東、緯度の南・北
REL = 'overturemaps-us-west-2/release/2026-09-23.0/'
VIA = ['吉塚', '博多', '鳥栖', '江北', '武雄温泉', '永尾']
ORDER = ['博多', '竹下', '笹原', '南福岡', '春日', '大野城', '水城', '都府楼南', '二日市', '天拝山', '原田', 'けやき台', '基山', '弥生が丘', '田代', '鳥栖',
         '新鳥栖', '肥前麓', '中原', '吉野ヶ里公園', '神埼', '伊賀屋', '佐賀', '鍋島', '久保田', '牛津', '江北', '大町', '北方', '高橋', '武雄温泉']
# OSM の駅名と、JR の駅名の書き方が違うもの（JR九州の駅名は「吉野ケ里公園」）
NAME_FIX = {'吉野ヶ里公園': '吉野ケ里公園'}
# バルーンさが駅は、佐賀インターナショナルバルーンフェスタの期間だけ開く臨時駅なので、駅の一覧には入れない（旅行の日は開いていない）
PAD = 0.3   # 両端の駅の先にも、少しだけ線を延ばす（km）


def hav(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def extract(kind, out):
    """Overture の GeoParquet から、範囲（BBOX）に入る行だけを読む（行グループの bbox の統計で絞る）"""
    import pyarrow.fs as pfs, pyarrow.parquet as pq
    from concurrent.futures import ThreadPoolExecutor
    from shapely import wkb
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    fs = pfs.S3FileSystem(anonymous=True, region='us-west-2', **({'proxy_options': proxy} if proxy else {}))
    base = REL + ('theme=transportation/type=segment/' if kind == 'rail' else 'theme=base/type=infrastructure/')
    paths = [i.path for i in fs.get_file_info(pfs.FileSelector(base)) if i.path.endswith('.parquet')]
    X0, X1, Y0, Y1 = BBOX

    def stat(md, rg, name):
        for c in range(md.num_columns):
            col = md.row_group(rg).column(c)
            if col.path_in_schema == name:
                return col.statistics

    def one(p):
        f = pq.ParquetFile(fs.open_input_file(p)); md = f.metadata; rgs = []
        for rg in range(md.num_row_groups):
            a, b, c, d = (stat(md, rg, 'bbox.' + k) for k in ('xmin', 'xmax', 'ymin', 'ymax'))
            if a is None or not a.has_min_max or (a.min <= X1 and b.max >= X0 and c.min <= Y1 and d.max >= Y0):
                rgs.append(rg)
        if not rgs:
            return []
        want = ('id', 'subtype', 'class', 'names', 'geometry', 'bbox', 'rail_flags')
        rows = f.read_row_groups(rgs, columns=[n for n in f.schema_arrow.names if n in want]).to_pylist()
        res = []
        for r in rows:
            bb = r.pop('bbox')
            if bb['xmin'] > X1 or bb['xmax'] < X0 or bb['ymin'] > Y1 or bb['ymax'] < Y0:
                continue
            if kind == 'rail' and r.get('subtype') != 'rail':
                continue
            if kind == 'station' and r.get('class') != 'railway_station':
                continue
            g = wkb.loads(r.pop('geometry'))
            if kind == 'station':
                g = g.centroid   # 佐賀駅などは建物の形で入っているので、真ん中の点にする
            res.append({'type': 'Feature', 'properties': r, 'geometry': g.__geo_interface__})
        return res

    with ThreadPoolExecutor(8) as ex:
        feats = [x for lst in ex.map(one, paths) for x in lst]
    json.dump({'type': 'FeatureCollection', 'features': feats}, open(out, 'w'), ensure_ascii=False, default=str)
    return feats


def load(kind, cache):
    fn = os.path.join(cache, kind + '.geojson')
    if os.path.exists(fn):
        return json.load(open(fn))['features']
    os.makedirs(cache, exist_ok=True)
    return extract(kind, fn)


def build_graph(rails):
    named = re.compile(r'鹿児島本線|Kagoshima Main|長崎線|長崎本線|佐世保線')
    skip = re.compile(r'新幹線|西鉄|西日本鉄道|地下鉄|跡|旧|国鉄|博多南線|臨港')
    G = {}
    k = lambda c: (round(c[0], 7), round(c[1], 7))
    for f in rails:
        p = f['properties']; nm = ((p.get('names') or {}).get('primary') or '')
        if skip.search(nm):
            continue
        flags = p.get('rail_flags') or []
        if any('is_abandoned' in (x.get('values') or []) or 'is_disused' in (x.get('values') or []) for x in flags if not x.get('between')):
            continue
        tun = [x.get('between') or [0, 1] for x in flags if 'is_tunnel' in (x.get('values') or [])]
        w = 1.0 if named.search(nm) else 1.6
        g = f['geometry']
        lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates'] if g['type'] == 'MultiLineString' else []
        for ln in lines:
            cum = [0.0]
            for a, b in zip(ln, ln[1:]):
                cum.append(cum[-1] + hav(a, b))
            tot = cum[-1] or 1
            for i, (a, b) in enumerate(zip(ln, ln[1:])):
                mid = (cum[i] + cum[i + 1]) / 2 / tot
                t = any(lo <= mid <= hi for lo, hi in tun)
                L = hav(a, b); A, B = k(a), k(b)
                G.setdefault(A, []).append((B, L * w, t)); G.setdefault(B, []).append((A, L * w, t))
    return G


def dijkstra(G, s, t):
    dist, prev, pq = {s: 0}, {}, [(0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == t:
            break
        if d > dist[u]:
            continue
        for v, w, tun in G[u]:
            nd = d + w
            if nd < dist.get(v, 1e18):
                dist[v] = nd; prev[v] = (u, tun); heapq.heappush(pq, (nd, v))
    path, tunf = [t], []
    while path[-1] != s:
        u, tun = prev[path[-1]]; path.append(u); tunf.append(tun)
    return path[::-1], tunf[::-1]


def simplify(pts, keep, tol_m):
    """Douglas-Peucker（平面に直してm単位）。keep の番号の点は必ず残す"""
    lat0 = math.radians(sum(p[1] for p in pts) / len(pts))
    xy = [((p[0]) * 111320 * math.cos(lat0), p[1] * 110570) for p in pts]
    mark = [False] * len(pts); mark[0] = mark[-1] = True
    for i in keep:
        mark[i] = True
    idx = [i for i, m in enumerate(mark) if m]

    def rec(a, b):
        ax, ay = xy[a]; bx, by = xy[b]; dx, dy = bx - ax, by - ay; l2 = dx * dx + dy * dy
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = xy[i]
            t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) if l2 else 0
            d = math.hypot(px - ax - t * dx, py - ay - t * dy)
            if d > best:
                best, bi = d, i
        if best > tol_m:
            mark[bi] = True; rec(a, bi); rec(bi, b)
    for a, b in zip(idx, idx[1:]):
        rec(a, b)
    return [i for i, m in enumerate(mark) if m]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default='tools/.relay-cache')
    ap.add_argument('--muni', required=True)
    ap.add_argument('--out', default='assets/line-relay.json')
    ap.add_argument('--tol', type=float, default=4.0)
    a = ap.parse_args()
    rails, stns = load('rail', a.cache), load('station', a.cache)
    G = build_graph(rails)
    st = {}
    for f in stns:
        nm = ((f['properties'].get('names') or {}).get('primary') or '').replace('駅', '')
        if f['geometry']['type'] == 'Point':
            st.setdefault(nm, []).append(f['geometry']['coordinates'])
    nodes = list(G)
    near = lambda c: min(nodes, key=lambda n: hav(n, c))
    vias = [near(st[n][0]) for n in VIA]
    path, tunf = [], []
    for s, t in zip(vias, vias[1:]):
        p, tf = dijkstra(G, s, t)
        path += p if not path else p[1:]; tunf += tf
    cum = [0.0]
    for x, y in zip(path, path[1:]):
        cum.append(cum[-1] + hav(x, y))

    def kmof(c):   # 点 c を線に吸着したときの km
        best = (1e18, 0)
        kx, ky = math.cos(math.radians(c[1])) * 111.32, 110.57
        for i in range(len(path) - 1):
            ax, ay = (path[i][0] - c[0]) * kx, (path[i][1] - c[1]) * ky
            bx, by = (path[i + 1][0] - c[0]) * kx, (path[i + 1][1] - c[1]) * ky
            dx, dy = bx - ax, by - ay; l2 = dx * dx + dy * dy
            t = max(0, min(1, -(ax * dx + ay * dy) / l2)) if l2 else 0
            d = math.hypot(ax + t * dx, ay + t * dy)
            if d < best[0]:
                best = (d, cum[i] + t * (cum[i + 1] - cum[i]))
        return best[1], best[0]

    k0, k1 = kmof(st['博多'][0])[0] - PAD, kmof(st['武雄温泉'][0])[0] + PAD

    def at(km):
        for i in range(len(cum) - 1):
            if cum[i] <= km <= cum[i + 1]:
                t = (km - cum[i]) / ((cum[i + 1] - cum[i]) or 1)
                return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t], i
        return list(path[-1]), len(path) - 2
    p0, i0 = at(k0); p1, i1 = at(k1)
    pts = [p0] + [list(x) for x in path[i0 + 1:i1 + 1]] + [p1]
    tun = [False] + tunf[i0 + 1:i1] + [tunf[i1]]   # tun[j]：pts[j]→pts[j+1] がトンネルか
    # トンネルの出入り口は残す
    keep = [j for j in range(1, len(pts) - 1) if tun[j - 1] != tun[j]]
    idx = simplify(pts, keep, a.tol)
    out = [[round(pts[i][0], 5), round(pts[i][1], 5)] for i in idx]
    gj = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {
        'name': 'リレーかもめ 博多〜武雄温泉（鹿児島本線・長崎本線・佐世保線）',
        'source': '© OpenStreetMap contributors（Overture Maps Foundation 経由, ODbL）を加工'}, 'geometry': {'type': 'LineString', 'coordinates': out}}]}
    json.dump(gj, open(a.out, 'w'), ensure_ascii=False, separators=(',', ':'))
    # ここから先は、書き出した線（間引いたもの）で km を測り直す（livemap.js と同じ）
    path = out; cum = [0.0]
    for x, y in zip(path, path[1:]):
        cum.append(cum[-1] + hav(x, y))
    print(f'{a.out}: {os.path.getsize(a.out)} bytes, {len(out)} points, len {cum[-1]:.2f} km', file=sys.stderr)
    # トンネル（間引く前の線で、どこからどこまでかを出し、間引いた線の km に直す）
    tl, j = [], 0
    while j < len(tun):
        if tun[j]:
            s = j
            while j < len(tun) and tun[j]:
                j += 1
            tl.append((kmof(pts[s])[0], kmof(pts[min(j, len(pts) - 1)])[0]))
        j += 1
    print('トンネル（すべて）:', [(round(x, 2), round(y, 2), round(y - x, 2)) for x, y in tl], file=sys.stderr)
    tunnels = [[round(x, 2), round(y, 2), ''] for x, y in tl if y - x >= 2]
    # 駅
    rows = []
    for n in ORDER:
        c = st[n][0] if len(st[n]) == 1 else min(st[n], key=lambda c: kmof(c)[1])
        km, off = kmof(c)
        rows.append([NAME_FIX.get(n, n), round(c[1], 5), round(c[0], 5), round(km, 2)])
        print(f'  {n}: {km:.2f} km（線から {off * 1000:.0f} m）', file=sys.stderr)
    # 市町村：線の上を200mおきに判定し、境目だけ残す
    from shapely.geometry import shape, Point
    from shapely.prepared import prep
    mu = []
    for f in json.load(open(a.muni))['features']:
        p = f['properties']
        if p['prefecture'] not in ('福岡県', '佐賀県'):
            continue
        g = shape(f['geometry'])
        if not g.intersects(shape({'type': 'Polygon', 'coordinates': [[[BBOX[0], BBOX[2]], [BBOX[1], BBOX[2]], [BBOX[1], BBOX[3]], [BBOX[0], BBOX[3]], [BBOX[0], BBOX[2]]]]})):
            continue
        name = p['prefecture'] + (p.get('county') or '') + p['municipality'] + (p.get('ward') or '')
        mu.append((name, prep(g)))
    munis, last, km = [], None, 0.0
    while km <= cum[-1]:
        i = max(0, min(len(cum) - 2, next((i for i in range(len(cum) - 1) if cum[i + 1] >= km), len(cum) - 2)))
        t = (km - cum[i]) / ((cum[i + 1] - cum[i]) or 1)
        q = Point(path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t)
        nm = next((n for n, g in mu if g.contains(q)), None)
        if nm and nm != last:
            munis.append([round(km, 1), nm]); last = nm
        km += 0.2
    print(json.dumps({'len': round(cum[-1], 2), 'stations': rows, 'munis': munis, 'tunnels': tunnels}, ensure_ascii=False))


if __name__ == '__main__':
    main()
