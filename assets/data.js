/* しおりのデータ（PDFしおりから転記） */
window.TRIP = {
  title: 'しおり',
  sub: 'Nara / Osaka',
  start: '2026-10-17T10:22:00+09:00',
  end: '2026-10-20T15:08:00+09:00',

  families: {
    yamaguchi: { name: '山口家', count: 2, label: '大人2名' },
    iizuka: { name: '飯塚家', count: 4, label: '大人2名・子ども2名' }
  },

  /* 指定席（号車・席） */
  seats: {
    kamome92: { yamaguchi: ['2A', '2B'], iizuka: ['2C', '2D', '3C', '3D'] },
    relay92: { yamaguchi: ['2C', '2D'], iizuka: ['2A', '2B', '3A', '3B'] },
    nozomi28: { yamaguchi: ['3D', '3E'], iizuka: ['1D', '1E', '2D', '2E'] },
    nozomi17: { yamaguchi: ['17D', '17E'], iizuka: ['19D', '19E', '20D', '20E'] },
    relay33: { yamaguchi: ['5C', '5D'], iizuka: ['5A', '5B', '6A', '6B'] },
    kamome33: { yamaguchi: ['19A', '19B'], iizuka: ['18C', '18D', '19C', '19D'] }
  },

  trains: {
    kamome92: { day: 1, dir: 'go', name: 'かもめ92号', kind: '西九州新幹線', car: 2, layout: 'AB|CD', rows: [2, 3], dep: '10:22', from: '新大村', arr: '10:37', to: '武雄温泉', min: 15, vehicle: 'N700S（6両）', timetable: 'https://t.ly/mF31l' },
    relay92: { day: 1, dir: 'go', name: 'リレーかもめ92号', kind: 'JR特急（在来線）', car: 4, layout: 'AB|CD', rows: [2, 3], dep: '10:40', from: '武雄温泉', arr: '11:42', to: '博多', min: 62, vehicle: '787系', timetable: 'https://t.ly/mF31l' },
    nozomi28: { day: 1, dir: 'go', name: 'のぞみ28号', kind: '山陽新幹線', car: 13, layout: 'ABC|DE', rows: [1, 2, 3], dep: '12:15', from: '博多', arr: '14:43', to: '新大阪', min: 148, vehicle: 'N700S（予定）', timetable: 'https://www.jrkyushu-timetable.jp/jr-k_time/2610/0030/00306001.html?c=11227&ym=202610&d=17' },
    nozomi17: { day: 4, dir: 'back', name: 'のぞみ17号', kind: '山陽新幹線', car: 12, layout: 'ABC|DE', rows: [17, 18, 19, 20], dep: '11:02', from: '新大阪', arr: '13:30', to: '博多', min: 148, vehicle: 'N700A（予定）', timetable: 'https://www.jrkyushu-timetable.jp/jr-k_time/2610/0019/00190001.html?c=28283&ym=202610&d=20' },
    relay33: { day: 4, dir: 'back', name: 'リレーかもめ33号', kind: 'JR特急（在来線）', car: 4, layout: 'AB|CD', rows: [5, 6], dep: '13:54', from: '博多', arr: '14:54', to: '武雄温泉', min: 60, vehicle: '787系', timetable: 'https://t.ly/hbZQc' },
    kamome33: { day: 4, dir: 'back', name: 'かもめ33号', kind: '西九州新幹線', car: 2, layout: 'AB|CD', rows: [18, 19], dep: '14:57', from: '武雄温泉', arr: '15:08', to: '新大村', min: 11, vehicle: 'N700S（6両）', timetable: 'https://t.ly/hbZQc' }
  },

  transfers: [
    { at: '武雄温泉', text: '同じホームの向かい側に乗り換える「対面乗り換え」。歩いてすぐです。', go: '3分', back: '3分' },
    { at: '博多', text: '乗り換え時間は、往路が約33分、復路が約24分。駅弁を買うなら手短に。', go: '33分', back: '24分' }
  ],

  /* のぞみ 19駅タイムライン（stop=停車駅、時刻は「頃」も含む目安） */
  nozomiLine: {
    nozomi28: [
      ['博多', '福岡', null, '12:15', 1], ['小倉', '福岡', '12:30', '12:31', 1], ['新下関', '山口', '12:36'], ['厚狭', '山口', '12:42'],
      ['新山口', '山口', '12:49'], ['徳山', '山口', '12:58'], ['新岩国', '山口', '13:07'], ['広島', '広島', '13:17', '13:18', 1],
      ['東広島', '広島', '13:26'], ['三原', '広島', '13:33'], ['新尾道', '広島', '13:36'], ['福山', '広島', '13:41', '13:41', 1],
      ['新倉敷', '岡山', '13:50'], ['岡山', '岡山', '13:57', '13:58', 1], ['相生', '兵庫', '14:13'], ['姫路', '兵庫', '14:17'],
      ['西明石', '兵庫', '14:23'], ['新神戸', '兵庫', '14:29', '14:30', 1], ['新大阪', '大阪', '14:43', null, 1]
    ],
    nozomi17: [
      ['新大阪', '大阪', null, '11:02', 1], ['新神戸', '兵庫', '11:14', '11:15', 1], ['西明石', '兵庫', '11:21'], ['姫路', '兵庫', '11:28'],
      ['相生', '兵庫', '11:32'], ['岡山', '岡山', '11:47', '11:48', 1], ['新倉敷', '岡山', '11:55'], ['福山', '広島', '12:03', '12:04', 1],
      ['新尾道', '広島', '12:09'], ['三原', '広島', '12:12'], ['東広島', '広島', '12:19'], ['広島', '広島', '12:27', '12:28', 1],
      ['新岩国', '山口', '12:38'], ['徳山', '山口', '12:47'], ['新山口', '山口', '12:56'], ['厚狭', '山口', '13:03'],
      ['新下関', '山口', '13:08'], ['小倉', '福岡', '13:13', '13:14', 1], ['博多', '福岡', '13:30', null, 1]
    ]
  },

  /* 乗車中に出す読みもの（直前の駅名で表示） */
  nozomiTips: {
    nozomi28: [
      { after: '小倉', tag: '鉄道メモ', title: '海の下を18.7km', text: '小倉〜新下関の間で新関門トンネルへ。長さ18,713mで、国内の鉄道トンネル7位（2026年3月時点）。' },
      { after: '新山口', tag: '路線', title: '山陽新幹線はトンネル多め', text: '新大阪〜博多は約560km。トンネルは142か所、合計約280km。車窓が暗くなる時間もこの路線らしさ。' },
      { after: '新尾道', tag: '車窓', title: 'もうすぐ福山。城をチェック', text: '福山城は新幹線ホームのすぐ北側（進行方向左）。停車中に落ち着いて眺められます。' },
      { after: '相生', tag: '車窓', title: '姫路城は左の窓', text: '姫路駅の北側、大手前通りの先に白鷺城。通過は14:17ごろ。' },
      { after: '西明石', tag: '鉄道メモ', title: '終盤にも16.25kmトンネル', text: '新神戸の先は六甲トンネル（16.25km、国内8位）。抜けると大阪はもうすぐ。' }
    ],
    nozomi17: [
      { after: '新大阪', tag: '出発', title: '新神戸までは12分', text: '発車後すぐに最初の停車駅。新神戸11:14着、そこから岡山までは32分。' },
      { after: '西明石', tag: '車窓', title: '姫路城は右の窓', text: '帰りは進行方向右（北側）。通過は11:28ごろ。' },
      { after: '新倉敷', tag: '車窓', title: '福山は帰りも停車', text: '12:03着・12:04発。往路で見逃したら、帰りにもう一度チャンス。' },
      { after: '広島', tag: '歴史', title: '山陽新幹線は2段階で開業', text: '新大阪〜岡山は1972年、岡山〜博多は1975年に開業。帰り道は約560kmを西へ。' },
      { after: '新下関', tag: '鉄道メモ', title: '本州→九州は海底トンネル', text: '新下関〜小倉で新関門トンネル（18,713m）を通過。1975年の博多開業で本州と九州が結ばれました。' }
    ]
  },

  castles: [
    { name: '三原城跡', station: '三原', side: '北側', go: '13:33ごろ（通過）', back: '12:12ごろ（通過）', goSide: '左', backSide: '右', text: '小早川隆景が築いた城の跡。三原駅のすぐ北側にあります。', url: 'https://www.google.com/maps/search/?api=1&query=%E4%B8%89%E5%8E%9F%E5%9F%8E%E8%B7%A1%E6%AD%B4%E5%8F%B2%E5%85%AC%E5%9C%92' },
    { name: '福山城', station: '福山', side: '北側・山側', go: '13:41ごろ（停車中）', back: '12:03〜12:04（停車中）', goSide: '左', backSide: '右', text: 'ホームから間近に見える、全国的にも珍しい城。停車中に落ち着いて眺められます。', url: 'https://fukuyamajo.jp/' },
    { name: '姫路城', station: '姫路', side: '北側', go: '14:17ごろ（通過）', back: '11:28ごろ（通過）', goSide: '左', backSide: '右', text: '世界文化遺産・国宝。白く優美な姿から「白鷺城」とも。', url: 'https://www.city.himeji.lg.jp/castle/' }
  ],

  ekiben: [
    ['博多食弁当', 1480, '辛子明太子・高菜・チキンカツなど博多グルメを幕の内風に'],
    ['ぐるり九州お肉の旅', 1480, '佐賀牛・熊本あか牛・鹿児島黒豚・宮崎鶏を食べ比べ'],
    ['かしわめし', 920, '鶏だしで炊いた博多の郷土の味。老舗の定番駅弁', 1],
    ['くまもとあか牛ランチボックス', 1480, 'くまモン容器がかわいい、あか牛すき焼き'],
    ['博多彩時記弁当', 1500, '白ごはん・山菜おこわ・ちらし寿司の3種＋彩りおかず'],
    ['焼き鯖めんたい弁当', 1080, '脂ののった焼き鯖と明太子をバター醤油で', 1],
    ['鮎屋三代', 1600, '天然鮎を丸ごと2匹。骨までやわらかい甘露煮'],
    ['黒豚めんたい弁当', 1430, '鹿児島県産黒豚と博多明太子を一度に'],
    ['豊後牛博多明太弁当', 1530, '大分ブランド牛「豊後牛」＋ゆず風味の辛子明太子'],
    ['博多名物 焼き鳥弁当', 980, 'たれ・塩の焼き鳥4種。おつまみ感覚でも', 1],
    ['九州トリップ弁当', 1350, '九州各県＋沖縄の名物グルメを9マスで少しずつ', 1]
  ],
  ekibenUrl: 'https://www.jrkyushu.co.jp/train/ekiben/',

  hotel: {
    name: 'からくさホテルグランデ新大阪タワー',
    address: '大阪府大阪市淀川区宮原3-3-24',
    tel: '06-6391-6602',
    url: 'https://karaksahotels.com/shin_osaka/access/',
    checkin: '15:00〜', checkout: '〜11:00',
    rooms: {
      r1: { no: '①', name: 'ハイフロア ロイヤルグランデルーム', family: 'iizuka', nights: '10/17（1泊）', from: '2026-10-17', to: '2026-10-18', size: '42㎡', bed: 'ダブル（160×200cm）×2台', price: 54950, code: 'TC552FDCD9BED' },
      r2: { no: '②', name: 'ハイフロア グランデルーム with Tatami', family: 'iizuka', nights: '10/18〜19（2泊）', from: '2026-10-18', to: '2026-10-20', size: '42㎡', bed: 'ダブル（140×200cm）×2台＋布団×2組', price: 52500, code: 'TDA6BA0688595' },
      r3: { no: '③', name: 'ハイフロア スーペリアツイン サウスビュー', family: 'yamaguchi', nights: '10/17〜19（3泊）', from: '2026-10-17', to: '2026-10-20', size: '23㎡', bed: 'ツイン（110×200cm）×2台', price: 74550, code: 'T2F5752C3515F' }
    }
  },

  /* 旅程 */
  days: [
    {
      n: 1, date: '2026-10-17', label: '10/17', dow: '土', color: 'day1', theme: '移動日',
      title: '新幹線を乗りついで、大阪へ',
      route: '新大村駅 → 新大阪駅 → ホテル',
      highlights: ['かもめ・リレーかもめ・のぞみ', '博多で駅弁', '大阪ステーションシティ'],
      items: [
        { t: 'stop', dep: '10:22', name: '新大村駅', kind: 'start', map: '新大村駅' },
        { t: 'move', min: 15, mode: 'shinkansen', line: 'JR西九州新幹線 かもめ92号', train: 'kamome92' },
        { t: 'stop', arr: '10:37', dep: '10:40', name: '武雄温泉駅', minor: 1, note: '向かいのホームへ対面乗り換え' },
        { t: 'move', min: 62, mode: 'train', line: 'JR特急 リレーかもめ92号', train: 'relay92' },
        { t: 'stop', arr: '11:42', dep: '12:15', name: '博多駅', minor: 1, note: '乗り換え約33分。駅弁を買うならここ', link: ['駅弁ランキング', '#/ride/ekiben'] },
        { t: 'move', min: 148, mode: 'shinkansen', line: 'JR山陽新幹線 のぞみ28号', train: 'nozomi28', link: ['いまどのへん？', '#/ride/live/nozomi28'] },
        { t: 'stop', arr: '14:43', dep: '14:50', name: '新大阪駅', note: '出口は4番口が最寄り', map: '新大阪駅' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '15:00', dep: '16:00', name: 'からくさホテルグランデ新大阪タワー', kind: 'hotel', note: 'チェックイン・ひと休み', map: 'からくさホテルグランデ新大阪タワー', qr: 1 },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '16:10', dep: '16:13', name: '新大阪駅', minor: 1 },
        { t: 'move', min: 6, mode: 'metro', line: 'Osaka Metro 御堂筋線 なかもず行', detail: '1番ホーム／3両目・240円' },
        { t: 'stop', arr: '16:19', name: '梅田駅', minor: 1, note: '出口は8番口が最寄り' },
        { t: 'move', min: 11, mode: 'walk', line: '徒歩', dist: '258m' },
        { t: 'stop', arr: '16:30', dep: '17:30', name: '大阪ステーションシティ', kind: 'spot', note: '大阪駅周辺をおさんぽ（滞在1時間）', map: '大阪ステーションシティ', url: 'https://osakastationcity.com/' },
        { t: 'move', min: 8, mode: 'walk', line: '徒歩', dist: '258m' },
        { t: 'stop', arr: '17:38', dep: '17:42', name: '梅田駅', minor: 1, note: '入口は8番口が最寄り' },
        { t: 'move', min: 6, mode: 'metro', line: 'Osaka Metro 御堂筋線 箕面萱野行', detail: '2番ホーム／1・3両目・240円' },
        { t: 'stop', arr: '17:48', name: '新大阪駅', minor: 1, note: '出口は4番口が最寄り' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '17:58', name: 'からくさホテルグランデ新大阪タワー', kind: 'goal', map: 'からくさホテルグランデ新大阪タワー' }
      ]
    },
    { n: 2, date: '2026-10-18', label: '10/18', dow: '日', color: 'day2', theme: '奈良へドライブ', title: '桜井の親戚宅と、奈良の大仏さま', route: 'ホテル → 桜井市 → 奈良公園・東大寺 → ホテル', highlights: ['レンタカー', 'まるかつ天理店', '東大寺・奈良公園の鹿', '阪神高速 環状線'] },
    { n: 3, date: '2026-10-19', label: '10/19', dow: '月', color: 'day3', theme: '大阪市内観光', title: '道頓堀から大阪城、夕方は展望テラスへ', route: 'ホテル → 道頓堀 → 大阪城公園 → ホテル → WowUs', highlights: ['道頓堀', '大阪城・JO-TERRACE', '堂島浜タワー WowUs'] },
    {
      n: 4, date: '2026-10-20', label: '10/20', dow: '火', color: 'day4', theme: '移動日',
      title: 'のぞみで世代違いを乗り比べて、帰路へ',
      route: 'ホテル → 新大阪駅 → 新大村駅',
      highlights: ['のぞみ17号（N700A）', '帰りも福山城', '15:08 新大村着'],
      items: [
        { t: 'stop', dep: '10:20', name: 'からくさホテルグランデ新大阪タワー', kind: 'start', note: 'チェックアウトは11:00まで' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '10:30', dep: '11:02', name: '新大阪駅', note: 'お弁当やおみやげはここで', map: '新大阪駅' },
        { t: 'move', min: 148, mode: 'shinkansen', line: 'JR山陽新幹線 のぞみ17号', train: 'nozomi17', link: ['いまどのへん？', '#/ride/live/nozomi17'] },
        { t: 'stop', arr: '13:30', dep: '13:54', name: '博多駅', minor: 1, note: '乗り換え約24分。売店が混みやすいので早めに' },
        { t: 'move', min: 60, mode: 'train', line: 'JR特急 リレーかもめ33号', train: 'relay33' },
        { t: 'stop', arr: '14:54', dep: '14:57', name: '武雄温泉駅', minor: 1, note: '向かいのホームへ対面乗り換え' },
        { t: 'move', min: 11, mode: 'shinkansen', line: 'JR西九州新幹線 かもめ33号', train: 'kamome33' },
        { t: 'stop', arr: '15:08', name: '新大村駅', kind: 'goal', note: 'おかえりなさい' }
      ]
    }
  ]
};
