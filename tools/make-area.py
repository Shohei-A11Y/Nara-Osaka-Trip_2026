#!/usr/bin/env python3
"""いまどのへん？の「住所」の地図・境界線・地名・自然地名のデータ（assets/area.json）を作る道具。

  出典
  - 市区町村の形：国土交通省 国土数値情報「行政区域データ」（CC BY 4.0）。
    形は細かい版が要るので 2020年版（N03-20200101。市区町村ごとの GeoJSON に分けたもの：github.com/niiyz/JapanCityGeoJson）を使い、
    名前・コード・府県は 16 の市町村の判定と同じ 2025年版（npm: japan-choropleth）と1件ずつ照らし合わせる（違えば止める）。
  - 地名のよみ（市区町村・自然地名）・山の標高・自然地名の位置：国土地理院 地理院地図Vector（地理院ベクトルタイル
    experimental_bvmap の縮尺11＝1/20万の注記・標高点・三角点）。山は注記の0.4km以内にある標高点（または三角点）を山頂とし、
    その標高を、地理院の標高タイル（dem_png 縮尺14）で山頂の高さと照らし合わせる（30m以上違えば載せない）。0.4km以内に複数あれば高い方。
  - 川の線：© OpenStreetMap contributors（ODbL）。Overture Maps Foundation 配布データ（release 2026-09-23.0）の base/water から
    名前の付いた川の線を抜き出し、線路と交わる所を求める。川の名前は、地理院の1/20万の注記（河川名）に同じ名前があり、
    その注記が同じ名前の川の線の0.5km以内にあるものだけ使う。

  使い方（リポジトリの一番上で）
    pip install shapely pyarrow mapbox-vector-tile pillow
    npm i --prefix tools/.area-cache/node topojson-server@3 topojson-simplify@3 topojson-client@3
    python3 tools/make-area.py
  → assets/area.json を書く。取り寄せたものは tools/.area-cache/ に置き、2回目からはそれを使う。
"""
import io, json, math, os, re, subprocess, sys, time, unicodedata, urllib.request
from concurrent.futures import ThreadPoolExecutor
from shapely.geometry import shape, mapping, LineString, MultiLineString, Point, Polygon, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union, transform
from shapely.ops import polylabel
from shapely.validation import make_valid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.area-cache')
ASSETS = os.path.join(ROOT, 'assets')
BUF_AREA = 16      # 市区町村の形を切り出す幅（線路の両側 km）
BUF_NAT = 41       # 山を探す幅（高い山は40kmまで）
SIMPLIFY = (6e-8, 3e-7)   # 形を軽くする度合い（Visvalingam の面積の下限。度の2乗＝約1万km²）。隣との境目は約600m²（長さ100m・ずれ12mほど）、海岸と切り出しの縁は約3000m²
JC_TGZ = 'https://registry.npmjs.org/japan-choropleth/-/japan-choropleth-0.1.0.tgz'
NIIYZ = 'https://raw.githubusercontent.com/niiyz/JapanCityGeoJson/master/geojson/{p}/{c}.json'
GSI_VT = 'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf'
GSI_DEM = 'https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png'
OVERTURE = 'overturemaps-us-west-2/release/2026-09-23.0/theme=base/type=water/'
CAPITALS = {'大阪市', '神戸市', '岡山市', '広島市', '山口市', '福岡市', '佐賀市'}   # 県庁所在地（線路沿いにあるもの）

LAT0 = 34.0
KX, KY = math.cos(math.radians(LAT0)) * 111.32, 110.57
fw = lambda x, y, z=None: (x * KX, y * KY)      # 経緯度 → km（線路沿いの幅を測るための平面。1.5%ほどの誤差は問題ない）
bw = lambda x, y, z=None: (x / KX, y / KY)
km = lambda a, b: math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY)


def std(t):
    """地理院の注記の互換漢字（例：塚 U+FA10）を、ふつうの漢字（塚 U+585A）にそろえる（ほかの文字はそのまま）"""
    return ''.join(unicodedata.normalize('NFKC', ch) if 0xF900 <= ord(ch) <= 0xFAFF else ch for ch in (t or ''))


def get(url, path, binary=True, tries=4):
    """取り寄せて保存（保存済みならそれを使う）"""
    if os.path.exists(path):
        return open(path, 'rb').read()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'shiori-make-area'}), timeout=60) as r:
                b = r.read()
            open(path, 'wb').write(b)
            return b
        except urllib.error.HTTPError as e:
            if e.code == 404:
                open(path, 'wb').write(b'')
                return b''
            time.sleep(2 ** i)
        except Exception:
            time.sleep(2 ** i)
    raise RuntimeError('取り寄せられません: ' + url)


def hav(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def valid(g):
    """形を正しく直し、面の部分だけ残す（buffer(0) は、向きの逆な形を消してしまうことがあるため使わない）"""
    v = make_valid(g)
    parts = [x for x in getattr(v, 'geoms', [v]) if x.geom_type in ('Polygon', 'MultiPolygon')]
    return unary_union(parts) if parts else Polygon()


def lines():
    out = {}
    for lid, f in [('sanyo', 'line-sanyo.json'), ('relay', 'line-relay.json')]:
        g = json.load(open(os.path.join(ASSETS, f)))
        out[lid] = LineString(g['features'][0]['geometry']['coordinates'])
    return out


def buffer_of(ls, w):
    return transform(bw, unary_union([transform(fw, l).buffer(w, resolution=24) for l in ls.values()]))


def tiles_for(poly, z):
    n = 2 ** z
    tx = lambda lon: int((lon + 180) / 360 * n)
    ty = lambda lat: int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    x0, y0, x1, y1 = poly.bounds
    out = []
    for x in range(tx(x0), tx(x1) + 1):
        for y in range(ty(y1), ty(y0) + 1):
            lo0, lo1 = x / n * 360 - 180, (x + 1) / n * 360 - 180
            la = lambda yy: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yy / n))))
            if Polygon([(lo0, la(y)), (lo1, la(y)), (lo1, la(y + 1)), (lo0, la(y + 1))]).intersects(poly):
                out.append((x, y))
    return out


def vt_features(z, x, y, layers):
    """地理院ベクトルタイル1枚の、指定の層の点を [(層, 属性, 経度, 緯度)] で返す"""
    import mapbox_vector_tile
    b = get(GSI_VT.format(z=z, x=x, y=y), os.path.join(CACHE, 'vt', f'{z}_{x}_{y}.pbf'))
    if not b:
        return []
    t = mapbox_vector_tile.decode(b)
    out = []
    n = 2 ** z
    for ly in layers:
        L = t.get(ly)
        if not L:
            continue
        ext = L.get('extent', 4096)
        for f in L['features']:
            g = f['geometry']
            if g['type'] != 'Point':
                continue
            px, py = g['coordinates']
            # mapbox_vector_tile は y を上向きに直して返す（y_coord_down=False）
            fx, fy = x + px / ext, y + (ext - py) / ext
            lon = fx / n * 360 - 180
            lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * fy / n))))
            out.append((ly, f['properties'], lon, lat))
    return out


def dem_at(lon, lat, z=14):
    """地理院の標高タイル（dem_png）で、その点の標高（m）。海・データなしは None"""
    from PIL import Image
    n = 2 ** z
    fx = (lon + 180) / 360 * n
    fy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    x, y = int(fx), int(fy)
    b = get(GSI_DEM.format(z=z, x=x, y=y), os.path.join(CACHE, 'dem', f'{z}_{x}_{y}.png'))
    if not b:
        return None
    im = Image.open(io.BytesIO(b)).convert('RGB')
    px, py = min(255, int((fx - x) * 256)), min(255, int((fy - y) * 256))
    best = None
    # 山頂の点は、まわり3画素（約30m）の中で一番高い所と比べる（標高タイルの格子と山頂の位置がずれるため）
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            qx, qy = px + dx, py + dy
            if not (0 <= qx < 256 and 0 <= qy < 256):
                continue
            r, g, bb = im.getpixel((qx, qy))
            v = r * 65536 + g * 256 + bb
            if v == 2 ** 23:
                continue
            h = (v - 2 ** 24 if v > 2 ** 23 else v) * 0.01
            best = h if best is None else max(best, h)
    return best


def municipalities(buf):
    """線路沿いにかかる市区町村（2025年版で選び、2020年版の細かい形を取り寄せて照らし合わせる）"""
    jc = os.path.join(CACHE, 'jc', 'package', 'data', 'geojson', 'municipalities.geojson')
    if not os.path.exists(jc):
        tgz = os.path.join(CACHE, 'jc.tgz')
        get(JC_TGZ, tgz)
        os.makedirs(os.path.join(CACHE, 'jc'), exist_ok=True)
        subprocess.check_call(['tar', 'xzf', tgz, '-C', os.path.join(CACHE, 'jc'), 'package/data/geojson/municipalities.geojson'])
    g = json.load(open(jc))
    bufk = transform(fw, buf)
    sel = []
    for f in g['features']:
        s = valid(shape(f['geometry']))
        if transform(fw, s).intersects(bufk):
            sel.append(f)

    def full(f):
        c = f['id']
        b = get(NIIYZ.format(p=c[:2], c=c), os.path.join(CACHE, 'n03', c + '.json'))
        return f, json.loads(b)
    with ThreadPoolExecutor(8) as ex:
        got = list(ex.map(full, sel))
    out = []
    for f, fg in got:
        p, q = f['properties'], fg['features'][0]['properties']
        # 2020年版：区は N03_003＝市・N03_004＝区、郡の町村は N03_003＝郡・N03_004＝町村
        same = (q.get('N03_004') == p['ward'] and q.get('N03_003') == p['municipality']) if p['ward'] else q.get('N03_004') == p['municipality']
        if q['N03_001'] != p['prefecture'] or q['N03_007'] != f['id'] or not same:
            sys.exit(f'2020年版と2025年版が違います: {f["id"]} {p} {q}')
        geom = unary_union([valid(shape(x['geometry'])) for x in fg['features']])
        out.append({'id': f['id'], 'pref': p['prefecture'], 'city': p['municipality'], 'ward': p['ward'], 'name': p['displayName'], 'full': geom})
    return out


def main():
    os.makedirs(CACHE, exist_ok=True)
    LS = lines()
    buf = buffer_of(LS, BUF_AREA)
    bufn = buffer_of(LS, BUF_NAT)
    linek = {k: transform(fw, v) for k, v in LS.items()}
    dist_line = lambda lon, lat: min(l.distance(Point(fw(lon, lat))) for l in linek.values())

    # ---------- 市区町村の形 ----------
    ms = municipalities(buf)
    print('市区町村', len(ms), file=sys.stderr)
    prefs = []
    for m in ms:
        if m['pref'] not in prefs:
            prefs.append(m['pref'])
        m['clip'] = valid(m['full'].intersection(buf))
    # 府県の並び：線路の西→東
    prefs.sort(key=lambda p: -min(m['full'].centroid.x for m in ms if m['pref'] == p))

    # ---------- 地理院の注記（縮尺11＝1/20万） ----------
    tl = tiles_for(bufn, 11)
    print('注記のタイル', len(tl), file=sys.stderr)
    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda t: vt_features(11, t[0], t[1], ['label', 'elevation', 'symbol']), tl))
    labs, elev = [], []
    seen = set()
    for r in res:
        for ly, p, lon, lat in r:
            key = (ly, p.get('knj'), p.get('alti'), round(lon, 5), round(lat, 5))
            if key in seen:
                continue
            seen.add(key)
            if ly == 'label':
                labs.append({'c': p.get('annoCtg'), 'knj': std(p.get('knj')), 'all': std(p.get('annoChar') or p.get('knj')), 'kana': p.get('kana') or '', 'lon': lon, 'lat': lat})
            elif p.get('alti') is not None:
                elev.append({'alti': float(p['alti']), 'lon': lon, 'lat': lat, 'ft': p.get('ftCode'), 'ly': ly})
    print('注記', len(labs), '標高点・三角点', len(elev), file=sys.stderr)

    # ---------- 市区町村名（よみ・置き場所） ----------
    areas = []
    # 大きな市の名前は1文字ずつの注記（姫・路・市）なので、同じ名前（annoChar）の8km以内の文字をまとめ、その真ん中を位置にする
    lab110 = []
    for l in labs:
        if l['c'] != 110:
            continue
        for g in lab110:
            if g['all'] == l['all'] and km((g['lon'], g['lat']), (l['lon'], l['lat'])) < 8:
                g['pts'].append((l['lon'], l['lat']))
                g['lon'] = sum(p[0] for p in g['pts']) / len(g['pts'])
                g['lat'] = sum(p[1] for p in g['pts']) / len(g['pts'])
                break
        else:
            lab110.append({'all': l['all'], 'kana': l['kana'], 'lon': l['lon'], 'lat': l['lat'], 'pts': [(l['lon'], l['lat'])]})
    def find110(name, geom):
        cand = [l for l in lab110 if l['all'] == name and geom.buffer(0.03).contains(Point(l['lon'], l['lat']))]   # 海の上に置かれた注記もあるので、形の3kmほど外まで
        cand.sort(key=lambda l: geom.distance(Point(l['lon'], l['lat'])))
        return cand[0] if cand else None
    def inside_pt(geom):
        """切り出した形の中で、いちばん広い部分の、縁から一番遠い点"""
        parts = list(geom.geoms) if geom.geom_type == 'MultiPolygon' else [geom]
        big = max(parts, key=lambda g: g.area)
        p = polylabel(transform(fw, big), tolerance=0.05)
        return bw(p.x, p.y)
    def grid_pts(clip, step, avoid):
        """名前の置き場所の候補：形の中（縁から0.8km以上内側）に step km おきの格子の点。avoid（地理院の注記の位置）から2km以内は除く"""
        inner = transform(fw, clip).buffer(-0.8)
        if inner.is_empty:
            return []
        x0, y0, x1, y1 = inner.bounds
        out = []
        gx = math.floor(x0 / step) * step
        while gx <= x1:
            gy = math.floor(y0 / step) * step
            while gy <= y1:
                if inner.contains(Point(gx, gy)) and (not avoid or math.hypot(gx - fw(*avoid)[0], gy - fw(*avoid)[1]) > 2):
                    lo, la = bw(gx, gy)
                    out.append([round(lo, 4), round(la, 4)])
                gy += step
            gx += step
        return out
    no_kana = []
    for m in ms:
        nm = m['ward'] or m['city']
        l = find110(nm, m['full'])
        m['kana'] = l['kana'] if l else ''
        if not l:
            no_kana.append(m['name'])
        ain = transform(fw, m['clip']).area
        if ain < 3:   # 線路沿いにかかるのがわずか（3km²未満）なら、名前は出さない
            continue
        pt = (l['lon'], l['lat']) if l and m['clip'].contains(Point(l['lon'], l['lat'])) else inside_pt(m['clip'])
        rank = 0 if (not m['ward'] and m['city'] in CAPITALS) else 2 if (m['ward'] or not m['city'].endswith('市')) else 1
        # 立体の視界（数km）にも名前が入るよう、注記の位置のほかに、形の中に3kmおきの候補を持たせる（地図では、見えている候補から1つだけ出す）
        areas.append([round(pt[0], 5), round(pt[1], 5), nm, m['kana'], rank, grid_pts(m['clip'], 3, pt)])
    # 政令市（区のある市）の名前は、市の注記の位置に別に出す
    for city in sorted({m['city'] for m in ms if m['ward']}):
        geom = unary_union([m['full'] for m in ms if m['city'] == city and m['ward']])
        clip = unary_union([m['clip'] for m in ms if m['city'] == city and m['ward']])
        l = find110(city, geom)
        if not l:
            no_kana.append(city)
            continue
        pt = (l['lon'], l['lat']) if clip.contains(Point(l['lon'], l['lat'])) else inside_pt(clip)
        areas.append([round(pt[0], 5), round(pt[1], 5), city, l['kana'], 0 if city in CAPITALS else 1, grid_pts(clip, 6, pt)])
    print('よみが見つからない市区町村', no_kana, file=sys.stderr)

    # ---------- 自然地名 ----------
    spots = []
    sys.path.insert(0, ROOT)
    js = open(os.path.join(ASSETS, 'line-data.js'), encoding='utf-8').read()
    for m in re.finditer(r'"name":"([^"]+)"[^{}]*?"lat":([\d.]+),"lon":([\d.]+)', js):
        spots.append((m.group(1), float(m.group(3)), float(m.group(2))))
    def in_spots(name, lon, lat):
        """見どころですでに出している名前は出さない（同じ名前・どちらかがもう一方を含み、5km以内）"""
        for s, so, sa in spots:
            base = re.sub(r'[（(].*?[）)]', '', s)
            d = km((lon, lat), (so, sa))
            if (name == s and d < 20) or ((name in s or base.startswith(name) or name.startswith(base)) and d < 5):
                return s
        return None
    nat, dropped = [], []
    def add(kind, name, kana, lon, lat, rank, alt=None):
        if name.startswith('（') or name.startswith('('):   # かっこ付きは別名（本来の名前の注記がそばにある）
            return
        sp = in_spots(name, lon, lat)
        if sp:
            dropped.append(f'{name}（見どころ「{sp}」と同じ）')
            return
        nat.append([round(lon, 5), round(lat, 5), kind, name, kana, alt, rank])

    # 山：注記の0.4km以内の標高点・三角点を山頂に。標高で、線路からの距離の上限を変える
    # 縮尺8（1/100万ほど）の地図にも名前が載る山は「名山」として広い縮尺から出す（同じ名前の別の山と混ぜないよう、位置も5km以内で照らし合わせる）
    z8 = []
    for t in tiles_for(buffer_of(LS, BUF_NAT), 8):
        for ly, p, lon, lat in vt_features(8, t[0], t[1], ['label']):
            if p.get('annoCtg') in (311, 315, 316):
                z8.append((std(p.get('knj')), lon, lat))
    is_z8 = lambda name, lon, lat: any(n == name and km((lon, lat), (x, y)) < 5 for n, x, y in z8)
    mts, mt_ng = [], []
    for l in labs:
        if l['c'] != 312:
            continue
        near = sorted(((km((l['lon'], l['lat']), (e['lon'], e['lat'])), e) for e in elev), key=lambda x: x[0])
        if not near or near[0][0] > 0.4:
            mt_ng.append(l['knj'] + '（標高点なし）')
            continue
        # 0.4km以内に標高点と三角点が両方あるときは、高い方が山頂（例：宮島の弥山は三角点529m・山頂535m）
        e = max((x for dd, x in near if dd <= 0.4), key=lambda x: x['alti'])
        d = dist_line(e['lon'], e['lat'])
        a = e['alti']
        lim = 40 if a >= 1000 else 25 if a >= 500 else 15
        if d > lim:
            continue
        mts.append((l, e, d))
    def chk(x):
        l, e, d = x
        h = dem_at(e['lon'], e['lat'])
        return x, h
    with ThreadPoolExecutor(8) as ex:
        mres = list(ex.map(chk, mts))
    seen_mt = set()
    for (l, e, d), h in mres:
        a = e['alti']
        if h is None or abs(h - a) > 30:
            mt_ng.append(f'{l["knj"]}（標高 {a:g}m・標高タイル {h}）')
            continue
        key = (l['knj'], round(e['lon'], 3), round(e['lat'], 3))
        if key in seen_mt:
            continue
        seen_mt.add(key)
        rank = 0 if (a >= 1000 or is_z8(l['knj'], e['lon'], e['lat'])) else 1 if a >= 600 else 2
        add('m', l['knj'], l['kana'], e['lon'], e['lat'], rank, int(round(a)))
    print('山', sum(1 for n in nat if n[2] == 'm'), '載せない山', len(mt_ng), file=sys.stderr)

    # 山地・高地・平野・半島・諸島・海・湾・灘・湖：1/20万の注記の位置。一文字ずつの注記は、同じ名前の文字の真ん中に
    groups = {}
    for l in labs:
        if l['c'] not in (311, 321, 333, 334, 344, 345, 346, 351):
            continue
        name = l['all']
        if l['c'] == 345 and not re.search(r'(湾|海|海峡|瀬戸|水道)$', name):
            continue
        if l['c'] == 321 and not re.search(r'(湖|池)$', name):
            continue
        k = (l['c'], name)
        gl = groups.setdefault(k, [])
        for g in gl:   # 3km以内の同じ名前は1つにまとめる（一文字ずつの注記・タイルの境目の重複）
            if km((g['lon'], g['lat']), (l['lon'], l['lat'])) < 3:
                g['pts'].append((l['lon'], l['lat']))
                g['lon'] = sum(p[0] for p in g['pts']) / len(g['pts'])
                g['lat'] = sum(p[1] for p in g['pts']) / len(g['pts'])
                break
        else:
            gl.append({'lon': l['lon'], 'lat': l['lat'], 'pts': [(l['lon'], l['lat'])], 'kana': l['kana']})
    LIM = {311: 20, 321: 12, 333: 20, 334: 20, 344: 25, 345: 20, 346: 20, 351: 20}
    KIND = {311: 'r', 321: 'l', 333: 'r', 334: 'r', 344: 's', 345: 's', 346: 'r', 351: 'r'}
    RANK = {311: 1, 321: 2, 333: 0, 334: 1, 344: 0, 345: 1, 346: 1, 351: 1}
    def rank_of(c, name):
        if c == 345:   # 海峡・〜海は広い縮尺から、湾は中くらい、瀬戸・水道（小さな海の通り道）は寄ったときだけ
            return 0 if re.search(r'(海峡|海)$', name) else 1 if name.endswith('湾') else 2
        return RANK[c]
    for (c, name), gl in groups.items():
        kept = []
        for g in sorted(gl, key=lambda g: dist_line(g['lon'], g['lat'])):
            if dist_line(g['lon'], g['lat']) > LIM[c]:
                continue
            if any(km((g['lon'], g['lat']), (k['lon'], k['lat'])) < 15 for k in kept):   # 同じ名前は15km以上離れたものだけ
                continue
            kept.append(g)
            add(KIND[c], name, g['kana'], g['lon'], g['lat'], rank_of(c, name))

    # 川：線路が渡る所。川の線（OpenStreetMap）の名前が、地理院の1/20万の河川名の注記にあり、その注記が同じ名前の川の線の0.5km以内にあるもの
    rv = rivers(LS)
    lab322 = {}
    for l in labs:
        if l['c'] == 322:
            lab322.setdefault(l['all'], []).append((l['lon'], l['lat']))
    crossings = []
    for name, geoms in rv.items():
        if name not in lab322:
            continue
        # 同じ名前の線を、つながっているもの（50m以内）ごとにまとめる（別の川の同じ名前と混ぜない）
        comps = []
        for g in geoms:
            gk = transform(fw, g)
            hit = [c for c in comps if c['k'].distance(gk) <= 0.05]
            for c in hit:
                comps.remove(c)
            comps.append({'k': unary_union([gk] + [c['k'] for c in hit]), 'g': unary_union([g] + [c['g'] for c in hit])})
        for comp in comps:
            if not any(comp['k'].distance(Point(fw(*p))) <= 0.5 for p in lab322[name]):
                continue
            for lid, l in LS.items():
                x = l.intersection(comp['g'])
                pts = [x] if x.geom_type == 'Point' else list(getattr(x, 'geoms', []))
                for p in pts:
                    if p.geom_type != 'Point':
                        continue
                    if any(c[0] == name and km((c[1], c[2]), (p.x, p.y)) < 3 for c in crossings):
                        continue
                    kana = next((l2['kana'] for l2 in labs if l2['c'] == 322 and l2['all'] == name), '')
                    crossings.append((name, p.x, p.y, kana, lid))
    # トンネルの中で川の下をくぐる所は「渡る所」ではないので除く（2km以上のトンネル。線路の起点からの km で照らし合わせる）
    tun = json.loads(subprocess.check_output(['node', '-e', "global.window={};require(process.argv[1]);const L=window.LINES||{sanyo:window.LINE};console.log(JSON.stringify(Object.fromEntries(Object.entries(L).map(([k,v])=>[k,v.tunnels]))))", os.path.join(ASSETS, 'line-data.js')]))
    def line_km(lid, lon, lat):
        cs = list(LS[lid].coords)
        best, acc = (1e9, 0), 0.0
        for a, b in zip(cs, cs[1:]):
            seg = LineString([fw(*a), fw(*b)])
            d = seg.distance(Point(fw(lon, lat)))
            if d < best[0]:
                best = (d, acc + seg.project(Point(fw(lon, lat))))
            acc += hav(a, b)
        return best[1]
    in_tun = []
    for name, lon, lat, kana, lid in crossings:
        k = line_km(lid, lon, lat)
        t = next((t for t in tun.get(lid, []) if t[0] + 0.1 <= k <= t[1] - 0.1), None)   # 入口・出口のすぐ外で渡る川（高梁川など）は残す
        if t:
            in_tun.append(f'{name}（{t[2] or "トンネル"}の中）')
            continue
        add('w', name, kana, lon, lat, 1)
    print('トンネルの中なので除いた川', in_tun, file=sys.stderr)
    print('川（線路が渡る所）', sum(1 for n in nat if n[2] == 'w'), file=sys.stderr)
    print('見どころと重なるので載せない', dropped, file=sys.stderr)
    print('載せない山（確かめられない）', mt_ng[:60], file=sys.stderr)

    # ---------- 形をつないで軽くする（topojson。隣どうしの境目を共有したまま軽くする） ----------
    # 輪の向きをそろえる（外側は左回り・穴は右回り。地図の塗りで、外側と穴を取り違えないように）
    ori = lambda g: MultiPolygon([orient(x, 1.0) for x in g.geoms]) if g.geom_type == 'MultiPolygon' else orient(g, 1.0)
    fc = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'id': m['id']}, 'geometry': mapping(ori(m['clip']))} for m in ms if not m['clip'].is_empty]}
    tmp = os.path.join(CACHE, 'clip.json')
    json.dump(fc, open(tmp, 'w'))
    topo = json.loads(subprocess.check_output(['node', os.path.join(ROOT, 'tools', 'make-area-topo.js'), tmp, str(SIMPLIFY[0]), str(SIMPLIFY[1])], env={**os.environ, 'NODE_PATH': os.path.join(CACHE, 'node', 'node_modules')}))
    byid = {m['id']: m for m in ms}
    geoms = []
    for g in topo['geoms']:
        m = byid[g['id']]
        geoms.append([m['id'], m['name'], m['kana'], prefs.index(m['pref']), g['col'], g['arcs']])
    out = {
        'v': 1,
        'src': {
            'area': '国土数値情報（行政区域データ・国土交通省）を加工',
            'names': '地理院ベクトルタイル（国土地理院）を加工',
            'rivers': '© OpenStreetMap contributors'
        },
        'prefs': prefs, 'tf': topo['tf'], 'arcs': topo['arcs'], 'm': geoms,
        'lab': sorted(areas, key=lambda a: (a[4], a[2])),
        'nat': sorted(nat, key=lambda a: (a[6], a[2], a[3]))
    }
    path = os.path.join(ASSETS, 'area.json')
    s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    open(path, 'w', encoding='utf-8').write(s + '\n')
    print('書き出し', path, len(s.encode()) // 1024, 'KB', '形', len(geoms), '線', len(topo['arcs']), '地名', len(areas), '自然地名', len(nat), file=sys.stderr)


def rivers(LS):
    """Overture の base/water から、線路のまわりの名前の付いた川の線（名前 → 線の一覧）"""
    path = os.path.join(CACHE, 'rivers.json')
    if not os.path.exists(path):
        import pyarrow.fs as pfs, pyarrow.parquet as pq, pyarrow.compute as pc
        from shapely import wkb
        proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
        fs = pfs.S3FileSystem(anonymous=True, region='us-west-2', **({'proxy_options': proxy} if proxy else {}))
        near = buffer_of(LS, 20)   # 地理院の河川名の注記と照らし合わせるため、線路から20kmまでの川の線を読む
        X0, Y0, X1, Y1 = near.bounds
        paths = [i.path for i in fs.get_file_info(pfs.FileSelector(OVERTURE)) if i.path.endswith('.parquet')]

        def st(md, rg, name):
            for c in range(md.num_columns):
                col = md.row_group(rg).column(c)
                if col.path_in_schema == name:
                    return col.statistics

        def one(p):
            f = pq.ParquetFile(fs.open_input_file(p)); md = f.metadata; out = []
            for rg in range(md.num_row_groups):
                a, b, c, d = (st(md, rg, 'bbox.' + k) for k in ('xmin', 'xmax', 'ymin', 'ymax'))
                if not (a and b and c and d and a.min <= X1 and b.max >= X0 and c.min <= Y1 and d.max >= Y0):
                    continue
                tb = f.read_row_group(rg, columns=['geometry', 'bbox', 'names', 'subtype', 'class'])
                bb = tb.column('bbox').combine_chunks()
                m = pc.and_(pc.and_(pc.less_equal(pc.struct_field(bb, 'xmin'), X1), pc.greater_equal(pc.struct_field(bb, 'xmax'), X0)),
                            pc.and_(pc.less_equal(pc.struct_field(bb, 'ymin'), Y1), pc.greater_equal(pc.struct_field(bb, 'ymax'), Y0)))
                for r in tb.filter(m).to_pylist():
                    nm = (r['names'] or {}).get('primary')
                    if not nm or r['class'] not in ('river', 'stream', 'canal'):
                        continue
                    g = wkb.loads(r['geometry'])
                    if g.geom_type in ('LineString', 'MultiLineString') and g.intersects(near):
                        out.append([nm, mapping(g)])
            return out
        with ThreadPoolExecutor(8) as ex:
            got = [x for r in ex.map(one, paths) for x in r]
        json.dump(got, open(path, 'w'), ensure_ascii=False)
    rv = {}
    for nm, g in json.load(open(path)):
        rv.setdefault(nm, []).append(shape(g))
    return rv


if __name__ == '__main__':
    main()
