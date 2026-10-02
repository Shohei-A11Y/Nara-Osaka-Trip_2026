"""10/18 のドライブの予定の道筋（assets/drive-route.json）を作る。
道路：国土地理院 最適化ベクトルタイル（optimal_bvmap-v1、z14 の RdCL）。高速道路（vt_motorway=1）と一般道に分けて、
PDFしおりの行程表・環状線の略図の矢印の順に置いた目印のあいだを最短でつなぐ（一般道は道幅の広い道を優先）。
使い方：pip install mapbox-vector-tile pillow のあと、このフォルダで python3 make.py → routes.json、
続けて export.py で assets/drive-route.json に書き出す（間引き・地点・環状線の向きの矢印）。
目印を変えたら rt.render(...) で地図に重ねて、道筋を目で確かめること。"""
import json, os, sys, rt

HW = lambda pr: 1.0 if pr.get('vt_motorway') == 1 else None
WID = {'19.5m以上': 1.0, '13m-19.5m未満': 1.1, '5.5m-13m未満': 1.5, '3m-5.5m未満': 3.0}
def ST(pr):
    if pr.get('vt_motorway') == 1:
        return None
    if pr.get('vt_code') not in (2701, 2703, 2704):
        pass
    return WID.get(pr.get('vt_rnkwidth'), 5.0)

def pad(pts, m=0.02):
    la = [p[0] for p in pts]; lo = [p[1] for p in pts]
    return (min(la) - m, min(lo) - m, max(la) + m, max(lo) + m)

def route(mode, pts, m=0.02):
    G, pos = rt.build(pad(pts, m), HW if mode == 'hw' else ST)
    out = []
    for a, b in zip(pts, pts[1:]):
        s, t = rt.nearest(G, pos, a), rt.nearest(G, pos, b)
        path = rt.dijkstra(G, s, t)
        if not path:
            print('NO PATH', mode, a, b, file=sys.stderr); sys.exit(1)
        seg = [pos[k] for k in path]
        out += seg if not out else seg[1:]
    return out

# 各区間の通り道（PDFしおりの行程表と、環状線の略図の矢印の順）
HOTEL = (34.73312, 135.49556)   # 宮原3-3-24。地理院の建物データの高層建物（2026-10-02に直した。前は34.7372, 135.4990で、北東へ約500mずれていた）
RENT = (34.7352, 135.4972)
REL = (34.51237, 135.86828)   # 親戚の家。利用者が地理院地図で示した場所（2026-10-03に直した。前は34.5005, 135.8655で、南へ約1kmずれていた）
LEGS = {
  'am': [
    ('st', [HOTEL, (34.7306, 135.4988), (34.7000, 135.5110)]),              # ホテル → 新御堂筋を南へ → 南森町ランプ（一般道）
    ('hw', [(34.7003, 135.5088), (34.6880, 135.5094), (34.6750, 135.5094),   # 守口線 → 環状線（東側を南へ）
            (34.6620, 135.5083), (34.6300, 135.5400), (34.5910, 135.5790),  # えびすJCT → 松原線 → 松原JCT
            (34.5700, 135.5770), (34.5530, 135.5760),                       # 阪和道 → 美原JCT
            (34.5450, 135.6200), (34.5170, 135.6900), (34.5000, 135.7300)]),  # 南阪奈道路 → 新庄
    ('st', [(34.4990, 135.7350), REL]),                     # 新庄ランプ → 桜井（親戚の家）
  ],
  'noon': [
    ('st', [REL, (34.5900, 135.8470), (34.6795, 135.8395)]),  # 親戚の家 → まるかつ天理店 → 奈良公園近くの駐車場
  ],
  'eve': [
    ('st', [(34.6795, 135.8395), (34.6830, 135.7620)]),                     # 駐車場 → 宝来ランプ
    ('hw', [(34.6835, 135.7600), (34.6690, 135.7200), (34.6780, 135.6000),   # 第二阪奈道路 → 西石切
            (34.6820, 135.5300), (34.6750, 135.5094), (34.6620, 135.5083),  # 東大阪線 → 東船場JCT → 環状線（東側を南へ）
            (34.6620, 135.4997), (34.6750, 135.4966), (34.6880, 135.4966),  # えびすJCT → 湊町 → 西側を北へ
            (34.6955, 135.5030), (34.6880, 135.5094),                       # 北側を東へ → 東側を南へ（一周）
            (34.6822, 135.5030), (34.6890, 135.4966)]),                     # 東船場JCTから近道 → 西船場JCT → 土佐堀出口
    ('st', [(34.6905, 135.4955), (34.7252, 135.4988), HOTEL]),              # 土佐堀ランプ → 新御堂筋を北へ → ホテル
  ],
}
if __name__ == '__main__':
    which = sys.argv[1:] or list(LEGS)
    res = {}
    for k in which:
        line = []
        for mode, pts in LEGS[k]:
            seg = route(mode, pts)
            line += seg if not line else seg
        res[k] = line
        print(k, len(line), file=sys.stderr)
    json.dump(res, open(os.path.join(rt.D, 'routes.json'), 'w'))
