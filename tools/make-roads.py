#!/usr/bin/env python3
"""いまどのへん？の地図に重ねる道路（高速道路・国道・主要地方道の抜粋）のデータ（assets/roads.json）を作る道具。

  出典：© OpenStreetMap contributors（ODbL）。Overture Maps Foundation 配布データ（release 2026-09-23.0）の
        transportation/segment（subtype=road）の class・names・routes（路線の種類 network と番号 ref）。線路の形と同じ出どころ。

  使い方（リポジトリの一番上で）
    pip install pyarrow shapely
    python3 tools/make-roads.py            # 抜き出したものは tools/.road-cache/ に置き、2回目からはそれを使う（2回流しても同じ結果）
  → assets/roads.json を書く。

  出すもの（全部の道路は出さない）
  - 高速道路（k: 'x'）：class=motorway（ランプ・連絡路 subclass=link は除く）。名前は OSM の名前（name）が日本語である区間だけ、
    線に沿って出す。山陽自動車道・中国自動車道などは、NEXCO の案内で使う短い呼び名（山陽道・中国道…）に直す（直すのは下の SHORT に
    書いたものだけ。ほかは元の名前のまま。「;」で2つ書かれているものは先の名前）。名前のない区間は線だけ。
  - 国道（k: 'n'）：routes に network=JP:national の番号（ref）があるもの。▽の中に番号の印。重なる区間は小さい番号。
  - 主要地方道（k: 'p'）：OSM の日本の決まりで主要地方道に付ける class=primary で、routes に都道府県道（network=JP:prefectural…）の番号が
    あるもの。六角形の中に番号（ref）。（OSM の日本の決まり：国道＝trunk・主要地方道＝primary・一般都道府県道＝secondary。
    元データでは、国道や主要地方道の名前の付いた道も primary・secondary にあるので、種類は class と network の両方で決める）
    一般都道府県道（secondary）・市町村道・細い道は出さない。番号のない区間は出さない。
  - 範囲：線路（山陽新幹線・リレーかもめ）の左右 CORR_KM（12km）。
  - 形は約 TOL_M（20m）で間引き、同じ道路（種類・番号・名前）の区間はまとめる。座標は約1m（1e5度）の格子に丸め、Google の polyline の書き方で文字にする。
"""
import json, math, os, re, sys

R = 6371.0088
REL = 'overturemaps-us-west-2/release/2026-09-23.0/theme=transportation/type=segment/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.road-cache')
LINES = ['assets/line-sanyo.json', 'assets/line-relay.json']
CORR_KM = 12.0
TOL_M = 20.0
WANT = {'motorway', 'trunk', 'primary', 'secondary'}
# 高速道路の短い呼び名（ふだん道路の案内・NEXCO で使う形）。当てはまらないものは、元の名前のまま
SHORT = {'山陽自動車道': '山陽道', '中国自動車道': '中国道', '九州自動車道': '九州道', '長崎自動車道': '長崎道', '名神高速道路': '名神', '新名神高速道路': '新名神'}
NAME_STEP_KM = 6.0   # 高速道路の名前を置く候補の間隔
SIGN_STEP_KM = 3.0   # 国道・主要地方道の印を置く候補の間隔
JA = re.compile(r'[\u3040-\u30ff\u4e00-\u9fff]')
# 道路の名前でないもの（出入口・ジャンクション・トンネル・橋などの名前が付いた区間）と、国道の番号だけの名前は、名前なし（線だけ）にする
NOT_ROAD = re.compile(r'ランプ|出口|入口|ＪＣＴ|JCT|ＩＣ|IC$|インター|トンネル|橋$|^国道\d+号')


def hav(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def line_boxes():
    out, pts = [], []
    for fn in LINES:
        cs = json.load(open(os.path.join(ROOT, fn)))['features'][0]['geometry']['coordinates']
        pts.append(cs)
        i0, acc = 0, 0.0
        for i in range(1, len(cs)):
            acc += hav(cs[i - 1], cs[i])
            if acc >= 6 or i == len(cs) - 1:
                xs = [p[0] for p in cs[i0:i + 1]]; ys = [p[1] for p in cs[i0:i + 1]]
                dy = CORR_KM / 110.57 + 0.01; dx = CORR_KM / (111.32 * math.cos(math.radians(ys[0]))) + 0.01
                out.append((min(xs) - dx, max(xs) + dx, min(ys) - dy, max(ys) + dy)); i0, acc = i, 0.0
    return out, pts


def extract(boxes):
    fn = os.path.join(CACHE, 'roads.geojson')
    if os.path.exists(fn):
        return json.load(open(fn))['features']
    import pyarrow.fs as pfs, pyarrow.parquet as pq
    from concurrent.futures import ThreadPoolExecutor
    from shapely import wkb
    os.makedirs(CACHE, exist_ok=True)
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    fs = pfs.S3FileSystem(anonymous=True, region='us-west-2', **({'proxy_options': proxy} if proxy else {}))
    paths = sorted(i.path for i in fs.get_file_info(pfs.FileSelector(REL)) if i.path.endswith('.parquet'))
    hit = lambda x0, x1, y0, y1: any(x0 <= b[1] and x1 >= b[0] and y0 <= b[3] and y1 >= b[2] for b in boxes)

    def stat(md, rg, name):
        for c in range(md.num_columns):
            col = md.row_group(rg).column(c)
            if col.path_in_schema == name:
                return col.statistics

    def one(p):
        f = pq.ParquetFile(fs.open_input_file(p)); md = f.metadata; res = []
        for rg in range(md.num_row_groups):
            a, b, c, d = (stat(md, rg, 'bbox.' + k) for k in ('xmin', 'xmax', 'ymin', 'ymax'))
            if not (a is None or not a.has_min_max or hit(a.min, b.max, c.min, d.max)):
                continue
            t = f.read_row_group(rg, columns=['subtype', 'class', 'subclass', 'bbox'])
            sub, cls, scl, bb = (t.column(k).to_pylist() for k in ('subtype', 'class', 'subclass', 'bbox'))
            idx = [i for i in range(len(sub)) if sub[i] == 'road' and cls[i] in WANT and scl[i] != 'link' and hit(bb[i]['xmin'], bb[i]['xmax'], bb[i]['ymin'], bb[i]['ymax'])]
            if not idx:
                continue
            rows = f.read_row_group(rg, columns=['id', 'class', 'names', 'routes', 'geometry']).take(idx).to_pylist()
            for r in rows:
                g = wkb.loads(r.pop('geometry'))
                res.append({'type': 'Feature', 'properties': r, 'geometry': g.__geo_interface__})
        return res

    with ThreadPoolExecutor(8) as ex:
        feats = [x for lst in ex.map(one, paths) for x in lst]
    feats.sort(key=lambda f: f['properties']['id'])
    json.dump({'type': 'FeatureCollection', 'features': feats}, open(fn, 'w'), ensure_ascii=False, default=str)
    return feats


def main():
    boxes, lines = line_boxes()
    feats = extract(boxes)
    print(f'道路 {len(feats)} 本を読みました', file=sys.stderr)
    from shapely.geometry import LineString, MultiLineString, Point, mapping
    from shapely.ops import linemerge
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    import importlib.util
    sp = importlib.util.spec_from_file_location('mlt', os.path.join(ROOT, 'tools', 'make-line-tunnels.py')); mlt = importlib.util.module_from_spec(sp); sp.loader.exec_module(mlt)
    rails = [mlt.Line(cs) for cs in lines]
    dist = lambda q: min(l.snap(q)[1] for l in rails)
    groups = {}
    for f in feats:
        p = f['properties']; g = f['geometry']
        parts = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates'] if g['type'] == 'MultiLineString' else []
        parts = [x for x in parts if len(x) > 1]
        if not parts:
            continue
        mid = parts[0][len(parts[0]) // 2]
        if dist(mid) > CORR_KM * 1000:
            continue
        rs = p.get('routes') or []
        nat = sorted({r['ref'] for r in rs if r.get('network') == 'JP:national' and (r.get('ref') or '').isdigit()}, key=int)
        pre = sorted({r['ref'] for r in rs if (r.get('network') or '').startswith('JP:prefectural') and (r.get('ref') or '').isdigit()}, key=int)
        if p['class'] == 'motorway':
            nm = ((p.get('names') or {}).get('primary') or '').split(';')[0].strip()
            k, t = 'x', (SHORT.get(nm, nm) if JA.search(nm) and not NOT_ROAD.search(nm) else '')
        elif nat:
            k, t = 'n', nat[0]
        elif p['class'] == 'primary' and pre:
            k, t = 'p', pre[0]
        else:
            continue
        groups.setdefault((k, t), []).extend(parts)
    out, npts = [], 0
    def enc(v):
        v = ~(v << 1) if v < 0 else v << 1
        s = ''
        while v >= 0x20:
            s += chr((0x20 | (v & 0x1f)) + 63); v >>= 5
        return s + chr(v + 63)
    for (k, t) in sorted(groups, key=lambda x: (x[0], x[1].zfill(4) if x[1].isdigit() else x[1])):
        ml = linemerge(MultiLineString(groups[(k, t)]))
        ls = list(ml.geoms) if ml.geom_type == 'MultiLineString' else [ml]
        tol = TOL_M / 111320
        ls = [x.simplify(tol, preserve_topology=False) for x in ls]
        ls = sorted([x for x in ls if x.length > 0], key=lambda x: (round(x.coords[0][0], 5), round(x.coords[0][1], 5)))
        strs = []
        for x in ls:
            cs = [(round(a * 1e5), round(b * 1e5)) for a, b in x.coords]
            dd = [cs[0]] + [(b[0] - a[0], b[1] - a[1]) for a, b in zip(cs, cs[1:])]
            dd = [d for i, d in enumerate(dd) if i == 0 or d != (0, 0)]
            if len(dd) < 2:
                continue
            strs.append(''.join(enc(a) + enc(b) for a, b in dd)); npts += len(dd)
        # 名前・印を置く候補：線に沿って一定の間隔で、その点と少し先の点（線の向き）。線路から CORR_KM 以内のものだけ
        cand = []
        if t:
            step = NAME_STEP_KM if k == 'x' else SIGN_STEP_KM
            for x in ls:
                cs = list(x.coords); cum = [0.0]
                for a, b in zip(cs, cs[1:]):
                    cum.append(cum[-1] + hav(a, b))
                d = step / 2
                while d < cum[-1] - 0.3:
                    i = next(j for j in range(len(cum) - 1) if cum[j + 1] >= d)
                    u = (d - cum[i]) / ((cum[i + 1] - cum[i]) or 1)
                    q = (cs[i][0] + (cs[i + 1][0] - cs[i][0]) * u, cs[i][1] + (cs[i + 1][1] - cs[i][1]) * u)
                    j = next((j for j in range(i, len(cum) - 1) if cum[j + 1] >= d + 0.3), len(cum) - 2)
                    q2 = cs[j + 1]
                    if dist(q) <= CORR_KM * 1000:
                        cand.append([round(q[0], 5), round(q[1], 5), round(q2[0], 5), round(q2[1], 5)])
                    d += step
        if strs:
            out.append({'k': k, 't': t, 'g': strs, 'c': cand})
    doc = {'v': 1, 'src': '© OpenStreetMap contributors（Overture Maps Foundation 経由, ODbL）を加工', 'roads': out}
    fn = os.path.join(ROOT, 'assets', 'roads.json')
    json.dump(doc, open(fn, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    import collections
    c = collections.Counter(r['k'] for r in out)
    print(f'assets/roads.json: {os.path.getsize(fn) // 1024} KB、点 {npts}、高速 {c["x"]}・国道 {c["n"]}・主要地方道 {c["p"]} 本（名前・番号ごと）', file=sys.stderr)
    print('高速道路の名前:', sorted({r["t"] for r in out if r["k"] == "x" and r["t"]}), file=sys.stderr)
    print('国道:', sorted({int(r["t"]) for r in out if r["k"] == "n"}), file=sys.stderr)
    if '--stat' in sys.argv:
        import collections
        c = collections.Counter(); syms = collections.Counter(); nets = collections.Counter()
        for f in feats:
            p = f['properties']; c[p['class']] += 1
            for r in p.get('routes') or []:
                nets[(p['class'], r.get('network'))] += 1; syms[r.get('symbol')] += 1
        print(c, file=sys.stderr); print(nets.most_common(20), file=sys.stderr); print(syms.most_common(10), file=sys.stderr)
        return


if __name__ == '__main__':
    main()
