"""routes.json（make.py の結果）を間引いて、assets/drive-route.json に書き出す"""
import json, math, os, rt
D = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(D, 'routes.json')))
def dp(pts, tol):
    if len(pts) < 3: return pts
    kx = 111320 * math.cos(math.radians(34.6)); ky = 110570
    P = [(p[1] * kx, p[0] * ky) for p in pts]
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    st = [(0, len(pts) - 1)]
    while st:
        a, b = st.pop(); ax, ay = P[a]; bx, by = P[b]; dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1
        best, bi = 0, None
        for i in range(a + 1, b):
            d = abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / L
            if d > best: best, bi = d, i
        if best > tol: keep[bi] = True; st += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]
PTS = [('ホテル', 34.73312, 135.49556, 'am'), ('南森町ランプ', 34.7000, 135.5092, 'am'), ('えびすJCT', 34.6570, 135.5040, 'am'), ('松原JCT', 34.5910, 135.5790, 'am'), ('美原JCT', 34.5530, 135.5760, 'am'), ('新庄ランプ', 34.4990, 135.7350, 'am'),
       ('親戚の家', 34.5005, 135.8655, 'noon'), ('まるかつ天理店', 34.5900, 135.8470, 'noon'), ('奈良公園近くの駐車場', 34.6795, 135.8395, 'noon'),
       ('宝来ランプ', 34.6835, 135.7600, 'eve'), ('西石切ランプ', 34.6770, 135.6310, 'eve'), ('東船場JCT', 34.6822, 135.5094, 'eve'), ('土佐堀ランプ', 34.6905, 135.4966, 'eve')]
out = {'type': 'FeatureCollection', 'features': []}
for k in ('am', 'noon', 'eve'):
    out['features'].append({'type': 'Feature', 'properties': {'leg': k}, 'geometry': {'type': 'LineString', 'coordinates': [[round(p[1], 5), round(p[0], 5)] for p in dp(R[k], 6)]}})
for name, la, lo, leg in PTS:
    p = min(R[leg], key=lambda q: rt.hav(q, (la, lo)))
    out['features'].append({'type': 'Feature', 'properties': {'name': name, 'leg': leg}, 'geometry': {'type': 'Point', 'coordinates': [round(p[1], 5), round(p[0], 5)]}})
eve = R['eve']
for la, lo in ((34.6750, 135.5094), (34.6750, 135.4966), (34.6955, 135.5030), (34.6620, 135.5083)):   # 環状線の4辺の中ほどに、時計回りの向きの矢印
    i = min(range(len(eve) - 1), key=lambda j: rt.hav(eve[j], (la, lo)))
    a, b = eve[i], eve[min(i + 3, len(eve) - 1)]
    y = math.sin(math.radians(b[1] - a[1])) * math.cos(math.radians(b[0])); x = math.cos(math.radians(a[0])) * math.sin(math.radians(b[0])) - math.sin(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.cos(math.radians(b[1] - a[1]))
    out['features'].append({'type': 'Feature', 'properties': {'arrow': round((math.degrees(math.atan2(y, x)) + 360) % 360)}, 'geometry': {'type': 'Point', 'coordinates': [round(a[1], 5), round(a[0], 5)]}})
json.dump(out, open(os.path.join(D, '..', '..', 'assets', 'drive-route.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
