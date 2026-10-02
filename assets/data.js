/* しおりのデータ（PDFしおり「奈良旅行しおり」から転記・再編集） */
window.TRIP = {
  start: '2026-10-17T10:22:00+09:00',
  end: '2026-10-20T15:08:00+09:00',

  families: {
    yamaguchi: { name: '山口家', count: 2, label: '大人2名' },
    iizuka: { name: '飯塚家', count: 4, label: '大人2名・子ども2名' }
  },

  /* ---------------- のりもの ---------------- */
  seats: {
    kamome92: { yamaguchi: ['2A', '2B'], iizuka: ['2C', '2D', '3C', '3D'] },
    relay92: { yamaguchi: ['2C', '2D'], iizuka: ['2A', '2B', '3A', '3B'] },
    nozomi28: { yamaguchi: ['3D', '3E'], iizuka: ['1D', '1E', '2D', '2E'] },
    nozomi17: { yamaguchi: ['17D', '17E'], iizuka: ['19D', '19E', '20D', '20E'] },
    relay33: { yamaguchi: ['5C', '5D'], iizuka: ['5A', '5B', '6A', '6B'] },
    kamome33: { yamaguchi: ['19A', '19B'], iizuka: ['18C', '18D', '19C', '19D'] }
  },

  trains: {
    kamome92: { dir: 'go', date: '2026-10-17', name: 'かもめ92号', short: 'かもめ', kind: '西九州新幹線', ticket: '指定席特急券', car: 2, layout: 'AB|CD', rows: [2, 3], dep: '10:22', from: '新大村', arr: '10:37', to: '武雄温泉', min: 15, vehicle: 'N700S（6両）', timetable: 'https://t.ly/mF31l', carNote: '1・2号車には特大荷物スペース付きの座席があります。' },
    relay92: { dir: 'go', date: '2026-10-17', name: 'リレーかもめ92号', short: 'リレーかもめ', kind: 'JR特急（在来線）', ticket: '指定席特急券', car: 4, layout: 'AB|CD', rows: [2, 3], dep: '10:40', from: '武雄温泉', arr: '11:42', to: '博多', min: 62, vehicle: '787系', timetable: 'https://t.ly/mF31l', carNote: '885系で運転される日は座席の配置が変わります。当日の案内を優先してください。' },
    nozomi28: { dir: 'go', date: '2026-10-17', name: 'のぞみ28号', short: 'のぞみ', kind: '山陽新幹線', ticket: '新幹線指定席特急券', car: 13, layout: 'ABC|DE', rows: [1, 2, 3], dep: '12:15', from: '博多', arr: '14:43', to: '新大阪', min: 148, vehicle: 'N700S（予定）', timetable: 'https://www.jrkyushu-timetable.jp/jr-k_time/2610/0030/00306001.html?c=11227&ym=202610&d=17', carNote: 'D・E席は2人掛け。E席が窓側です。' },
    nozomi17: { dir: 'back', date: '2026-10-20', name: 'のぞみ17号', short: 'のぞみ', kind: '山陽新幹線', ticket: '新幹線指定席特急券', car: 12, layout: 'ABC|DE', rows: [17, 18, 19, 20], dep: '11:02', from: '新大阪', arr: '13:30', to: '博多', min: 148, vehicle: 'N700A（予定）', timetable: 'https://www.jrkyushu-timetable.jp/jr-k_time/2610/0019/00190001.html?c=28283&ym=202610&d=20', carNote: '往路とは号車も座る位置も変わります。' },
    relay33: { dir: 'back', date: '2026-10-20', name: 'リレーかもめ33号', short: 'リレーかもめ', kind: 'JR特急（在来線）', ticket: '指定席特急券', car: 4, layout: 'AB|CD', rows: [5, 6], dep: '13:54', from: '博多', arr: '14:54', to: '武雄温泉', min: 60, vehicle: '787系', timetable: 'https://t.ly/hbZQc', carNote: '885系で運転される日は座席の配置が変わります。' },
    kamome33: { dir: 'back', date: '2026-10-20', name: 'かもめ33号', short: 'かもめ', kind: '西九州新幹線', ticket: '指定席特急券', car: 2, layout: 'AB|CD', rows: [18, 19], dep: '14:57', from: '武雄温泉', arr: '15:08', to: '新大村', min: 11, vehicle: 'N700S（6両）', timetable: 'https://t.ly/hbZQc', carNote: '往路と同じ2号車。今度は後ろ寄りの18・19番です。' }
  },

  transfers: {
    go: [
      { at: '武雄温泉', wait: '3分', text: '同じホームの向かい側に止まっている列車へ乗り換えます（対面乗り換え）。歩いてすぐです。' },
      { at: '博多', wait: '33分', text: '在来線ホームから新幹線ホーム（往路は12番のりば）へ。駅弁は2F新幹線改札内のコンコースが一番早く買えます。' }
    ],
    back: [
      { at: '博多', wait: '24分', text: '新幹線ホームから在来線ホームへ。売店が混みやすいので、買い物は早めに。' },
      { at: '武雄温泉', wait: '3分', text: '向かい側の列車へ対面乗り換え。' }
    ]
  },

  /* のぞみ 19駅（[駅, 府県, 着/通過, 発, 停車]） */
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

  nozomiTips: {
    nozomi28: [
      { after: '博多', tag: '出発', title: '最初の停車は小倉、15分後', text: '博多を出るとすぐ小倉。そこから広島までは46分走ります。' },
      { after: '小倉', tag: '鉄道メモ', title: '海の下を18.7km', text: '小倉〜新下関の間で新関門トンネルへ。長さ18,713mで、国内の鉄道トンネル7位（2026年3月時点）。' },
      { after: '新山口', tag: '路線', title: '山陽新幹線はトンネル多め', text: '新大阪〜博多は約560km。トンネルは142か所、合計約280km。車窓が暗くなる時間もこの路線らしさ。' },
      { after: '三原', tag: '車窓', title: 'もうすぐ福山。城は左の窓', text: '福山城は新幹線ホームのすぐ北側。停車中に落ち着いて眺められます。' },
      { after: '岡山', tag: '車窓', title: '姫路城も左の窓', text: '姫路駅の北側、大手前通りの先に白鷺城。通過は14:17ごろ。' },
      { after: '西明石', tag: '鉄道メモ', title: '終盤にも16.25kmトンネル', text: '新神戸の先は六甲トンネル（16.25km、国内8位）。抜けると大阪はもうすぐ。' }
    ],
    nozomi17: [
      { after: '新大阪', tag: '出発', title: '新神戸までは12分', text: '発車後すぐに最初の停車駅。新神戸11:14着、そこから岡山までは32分。' },
      { after: '新神戸', tag: '車窓', title: '姫路城は右の窓', text: '帰りは進行方向の右（北側）。通過は11:28ごろ。' },
      { after: '新倉敷', tag: '車窓', title: '福山は帰りも停車', text: '12:03着・12:04発。往路で見逃したら、帰りにもう一度チャンス。' },
      { after: '広島', tag: '歴史', title: '山陽新幹線は2段階で開業', text: '新大阪〜岡山は1972年、岡山〜博多は1975年に開業。帰り道は約560kmを西へ。' },
      { after: '新下関', tag: '鉄道メモ', title: '本州から九州へ、海底トンネル', text: '新下関〜小倉で新関門トンネル（18,713m）を通過。1975年の博多開業で本州と九州が結ばれました。' }
    ]
  },

  castles: [
    { name: '三原城跡', station: '三原', side: '北側', go: '13:33ごろ・通過', back: '12:12ごろ・通過', text: '小早川隆景が築いた城の跡。三原市は、三原城跡歴史公園を「三原駅北のお濠の周り」と案内しています。', url: 'https://www.city.mihara.hiroshima.jp/site/kyouiku/reksikoen.html' },
    { name: '福山城', station: '福山', side: '北側・山側', go: '13:41ごろ・停車中', back: '12:03〜12:04・停車中', text: '新幹線ホームから間近に見える、全国的にも珍しい城。往復とも福山に停車するので、落ち着いて眺められます。', url: 'https://fukuyamajo.jp/' },
    { name: '姫路城', station: '姫路', side: '北側', go: '14:17ごろ・通過', back: '11:28ごろ・通過', text: '世界文化遺産・国宝。白く優美な姿から「白鷺城」とも。姫路駅北側の大手前通りの先にあります。', url: 'https://www.city.himeji.lg.jp/castle/' }
  ],

  ekiben: [
    ['博多食弁当', 1480, '辛子明太子・高菜・チキンカツなど、博多グルメを幕の内風に'],
    ['ぐるり九州お肉の旅', 1480, '佐賀牛・熊本あか牛・鹿児島黒豚・宮崎鶏の食べ比べ'],
    ['かしわめし', 920, '鶏だしで炊いた博多の郷土の味。老舗の味を引き継ぐ定番', 1],
    ['くまもとあか牛ランチボックス', 1480, 'くまモン容器がかわいい、あか牛のすき焼き'],
    ['博多彩時記弁当', 1500, '白ごはん・山菜おこわ・ちらし寿司の3種＋彩りおかず'],
    ['焼き鯖めんたい弁当', 1080, '脂ののった焼き鯖と明太子をバター醤油で', 1],
    ['鮎屋三代', 1600, '熊本県産の天然鮎を丸ごと2匹。骨までやわらかい甘露煮'],
    ['黒豚めんたい弁当', 1430, '鹿児島県産黒豚と博多明太子を一度に'],
    ['豊後牛博多明太弁当', 1530, '大分の「豊後牛」＋ゆず風味の辛子明太子'],
    ['博多名物 焼き鳥弁当', 980, 'たれ・塩の焼き鳥4種盛り', 1],
    ['九州トリップ弁当', 1350, '九州各県＋沖縄の名物を9マスで少しずつ', 1]
  ],
  ekibenUrl: 'https://www.jrkyushu.co.jp/train/ekiben/',

  railTrivia: [
    { train: 'かもめ', model: 'N700S', facts: [['6両', '編成'], ['391人', '定員'], ['260km/h', '最高速度']], items: [
      ['16両と6両。でも兄弟', 'どちらもN700S。床下機器の小型・軽量化などで、路線に合わせて編成を柔軟に組めるのがN700Sの特徴。今回は西九州の6両と山陽の16両を乗り比べられます。'],
      ['指定席はゆったり2+2', '1〜3号車の指定席は横4席、4〜6号車の自由席は横5席。今回の2号車は2+2列です。'],
      ['停電しても自力で動ける', 'N700Sは高速鉄道として世界初のバッテリ自走システムを採用。長時間の停電時も、避難しやすい場所まで低速で移動できます。'],
      ['西九州の専用仕様', '白を基本に、JR九州のコーポレートカラーの赤を配した外観。車内は和洋折衷で、クラシックとモダンを組み合わせた「九州らしいオンリーワン」の空間です。']
    ] },
    { train: 'リレーかもめ', model: '787系', facts: [['1992年', '「つばめ」でデビュー'], ['2022年', 'リレーかもめへ'], ['30年超', '現役で走る']], items: [
      ['始まりは1992年の「つばめ」', '鹿児島本線の新特急「つばめ」としてデビュー。ガンメタルカラーの重厚なボディで登場しました。デザインは水戸岡鋭治さん。'],
      ['目指したのは「ホテル並み」', 'デビューのとき、目的地までの時間に「ホテル並みの居住性とサービス」を追求した車両です。移動そのものを楽しんでもらう発想でした。'],
      ['国内外で評価されたデザイン', '1993年にグッドデザイン商品に選定、1994年には国際的な鉄道デザイン賞「ブルネル賞」を受賞しました。'],
      ['「36ぷらす3」にも787系のDNA', '787系を改造して生まれた観光列車「36ぷらす3」。同じ787系が、役割を変えて走り続けています。']
    ] },
    { train: 'のぞみ', model: 'N700S・N700A', facts: [['300km/h', '山陽区間の最高速度'], ['2時間28分', '今回の所要時間'], ['2世代', '往復で乗り比べ']], items: [
      ['往復で世代違いを乗り比べ', '往路の28号はN700S（2020年デビュー、SはSupreme）。復路の17号はN700A（2013年デビュー、AはAdvanced）。'],
      ['N700Sは全席コンセント', '背もたれと座面が連動して傾くリクライニング、揺れを抑える制振装置など、約2時間半を快適に過ごす工夫がたくさん。N700Aは窓側と最前・最後部の席にコンセント。'],
      ['カーブでも時間を稼ぐ', 'N700系は、日本の新幹線で初めて車体傾斜システムを採用しました。カーブで車体を少し傾け、曲線区間でも速度を上げて走れるようにしています。'],
      ['原点は1992年の300系', '初代「のぞみ」は300系。1992年3月に営業運転を始め、最高270km/hで東京〜新大阪を2時間30分で結びました。']
    ] }
  ],

  /* ---------------- やど・くるま ---------------- */
  hotel: {
    name: 'からくさホテルグランデ新大阪タワー',
    address: '大阪府大阪市淀川区宮原3-3-24',
    tel: '06-6391-6602',
    url: 'https://karaksahotels.com/shin_osaka/access/',
    checkin: '15:00〜', checkout: '〜11:00',
    access: '新大阪駅から徒歩約5分（410m）',
    plan: '3部屋とも「10周年記念 朝食付きプラン（30%オフ）」で予約済み。',
    pay: '現地で支払い。VISA・Master・JCB・AMEX・Diners Club・UC・DC・NICOS・UFJ・銀聯のカード、電子マネー、QRコード決済が使えます（タッチ決済の可否は公式サイトに記載なし）。',
    soine: '添い寝は通常6歳以下が無料（添い寝ベッド1台につき1名・1室2名まで）。公式サイト予約なら12歳以下も無料で、朝食付きプランなら添い寝の子の朝食も無料。',
    perks: [
      ['荷物あずかり', '2階フロントで、チェックイン前とチェックアウト後の荷物を無料であずかってくれます。'],
      ['ウェルカムドリンク', '3階 Gochisou-SUN で14:00〜22:00は無料。'],
      ['Wi-Fi・テレビ', '館内・客室とも無料Wi-Fi。客室テレビはHDMIでつなげます（客室により異なる場合あり）。'],
      ['自動販売機', '4階にはアルコールの自販機と製氷機も。10・15・20階にも自販機コーナーがあります。']
    ],
    floors: [
      ['24F', '最上階・屋上'],
      ['15〜23F', 'ハイフロア客室。予約した3部屋はすべてここ', 1],
      ['5〜14F', '客室（スタンダードフロア）'],
      ['4F', '大浴場・サウナ・ランドリー', 1],
      ['3F', '朝食会場 Gochisou-SUN', 1],
      ['1〜2F', 'エントランス・フロント', 1]
    ],
    breakfast: { place: '3F Gochisou-SUN', time: '6:30〜10:30（最終入店10:00）', text: '日替わりのパン・サラダ・大阪名物など、約40種のビュッフェ。' },
    bath: { place: '4F・宿泊者は無料', time: ['15:00〜25:00', '5:00〜10:00'], text: '男女別。鍵付きロッカー、シャンプー類、ドライヤー、ウォーターサーバーあり。', warn: 'タオルは大浴場にないので、客室から持っていきます。' },
    /* 予約番号とチェックインQR（r1〜r3 の code と QR の SVG）。合言葉から PBKDF2-SHA256 で鍵を作り、AES-GCM で暗号にした形だけを置く */
    lock: { iter: 250000, salt: 'nVyq21IACjm8csYYAam7Nw==', iv: 'kd70sXXx3OYEYJEs', data: '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' },
    rooms: {
      r1: { no: '①', name: 'ハイフロア ロイヤルグランデルーム', family: 'iizuka', who: '飯塚家4名', nights: '10/17（1泊）', from: '2026-10-17', to: '2026-10-18', size: '42㎡', bed: 'ダブル（160×200cm）×2台', bath: 'シャワー・バスタブ・トイレ', list: 78500, off: 23550, price: 54950 },
      r2: { no: '②', name: 'ハイフロア グランデルーム with Tatami', family: 'iizuka', who: '飯塚家4名', nights: '10/18〜19（2泊）', from: '2026-10-18', to: '2026-10-20', size: '42㎡', bed: 'ダブル（140×200cm）×2台＋布団（90×200cm）×2組', bath: 'シャワー・バスタブ・トイレ', list: 75000, off: 22500, price: 52500 },
      r3: { no: '③', name: 'ハイフロア スーペリアツイン サウスビュー', family: 'yamaguchi', who: '山口家2名', nights: '10/17〜19（3泊）', from: '2026-10-17', to: '2026-10-20', size: '23㎡', bed: 'ツイン（110×200cm）×2台', bath: 'シャワー・バスタブ・トイレ', list: 106500, off: 31950, price: 74550, amenity: 'USBポート・冷蔵庫・電気ケトル・加湿空気清浄機・ナイトウェア・スリッパ・タオル・歯ブラシ・シャンプー類・ドライヤー' }
    }
  },

  car: {
    shop: 'ニッポンレンタカー 新大阪駅新幹線口営業所',
    klass: 'ミニバンクラス【YP】',
    klassNote: 'ヴォクシー7人乗り・セレナ8人乗りなど（車種は選べません）。禁煙車を希望済み。',
    /* 予約番号は公開ファイルに置かない（画面では「予約メールをご確認ください」と出す） */
    out: '2026-10-18T08:00:00+09:00', back: '2026-10-18T20:00:00+09:00',
    outLabel: '10/18（日）8:00', backLabel: '10/18（日）20:00',
    plannedBack: '17:50',
    address: '大阪府大阪市淀川区西宮原1-2-58',
    tel: '050-1712-2489',
    access: '新大阪駅（北口）から徒歩約7分',
    lines: [['基本料金（1台）', 18040], ['早割14キャンペーン', -4950], ['NOC補償制度（ECO）セット', 440], ['ベビーシート', 1100], ['チャイルドシート', 1100], ['ETC車載器', 0]],
    total: 15730,
    included: ['免責補償込み', 'カーナビ', 'ベビーシート', 'チャイルドシート', 'ETC車載器'],
    pay: '現地で支払い。ミニバンクラスはクレジットカード決済が必須です（Master・VISA・JCB・アメリカン・エキスプレス・ダイナースクラブ・DC等）。',
    notes: [
      ['返すとき', 'ガソリンを満タンにして返却します。'],
      ['免許証', '運転する人全員の運転免許証（日本国内で有効なもの）を見せます。'],
      ['NOC（休業補償）', 'ECOに加入済み。事故・故障によるNOCは0円。盗難・汚損・臭気によるNOCは対象外で、別途負担です。'],
      ['キャンセル料', '7日前まで無料。以降段階的に増え、当日は基本料金の50%（上限¥6,000）。'],
      ['送迎が必要なら', '新大阪阪急ビル1F「新大阪駅新幹線口営業所 受付カウンター」（大阪市淀川区宮原1-1-1・受付8:00〜17:00）。']
    ]
  },

  /* ---------------- 旅程 ---------------- */
  days: [
    {
      n: 1, date: '2026-10-17', label: '10/17', dow: '土', color: 'day1', theme: '移動日',
      title: '新幹線を乗りついで、大阪へ',
      route: '新大村駅 → 新大阪駅 → ホテル',
      summary: '全11地点・10区間',
      items: [
        { t: 'stop', dep: '10:22', name: '新大村', type: 'station', roma: 'Shin-Ōmura', kind: 'start' },
        { t: 'move', min: 15, mode: 'shinkansen', line: '西九州新幹線 かもめ92号', train: 'kamome92' },
        { t: 'stop', arr: '10:37', dep: '10:40', name: '武雄温泉', type: 'station', roma: 'Takeo-Onsen', minor: 1, note: '向かい側のホームへ対面乗り換え' },
        { t: 'move', min: 62, mode: 'train', line: 'JR特急 リレーかもめ92号', train: 'relay92' },
        { t: 'stop', arr: '11:42', dep: '12:15', name: '博多', type: 'station', roma: 'Hakata', note: '乗り換え約33分。駅弁を買うならここ', link: ['駅弁ランキング', '#/ride/ekiben'] },
        { t: 'move', min: 148, mode: 'shinkansen', line: '山陽新幹線 のぞみ28号', train: 'nozomi28' },
        { t: 'stop', arr: '14:43', dep: '14:50', name: '新大阪', type: 'station', roma: 'Shin-Ōsaka', note: '最寄りの出口は4番口' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '15:00', dep: '16:00', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', note: 'チェックインして、ひと休み', qr: 1, to: '#/stay' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '16:10', dep: '16:13', name: '新大阪', type: 'station', roma: 'Shin-Ōsaka', minor: 1 },
        { t: 'move', min: 6, mode: 'metro', line: 'Osaka Metro 御堂筋線 なかもず行', detail: '1番ホーム・3両目／240円' },
        { t: 'stop', arr: '16:19', name: '梅田', type: 'station', roma: 'Umeda', minor: 1, note: '最寄りの出口は8番口' },
        { t: 'move', min: 11, mode: 'walk', line: '徒歩', dist: '258m' },
        { t: 'stop', arr: '16:30', dep: '17:30', name: '大阪ステーションシティ', type: 'spot', note: '大阪駅のまわりをおさんぽ（滞在1時間）', to: '#/spot/osakastation' },
        { t: 'move', min: 8, mode: 'walk', line: '徒歩', dist: '258m' },
        { t: 'stop', arr: '17:38', dep: '17:42', name: '梅田', type: 'station', roma: 'Umeda', minor: 1, note: '最寄りの入口は8番口' },
        { t: 'move', min: 6, mode: 'metro', line: 'Osaka Metro 御堂筋線 箕面萱野行', detail: '2番ホーム・1・3両目／240円' },
        { t: 'stop', arr: '17:48', name: '新大阪', type: 'station', roma: 'Shin-Ōsaka', minor: 1, note: '最寄りの出口は4番口' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '17:58', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', kind: 'goal' }
      ],
      dinner: '夕ごはんは、梅田か新大阪の候補から選びます。'
    },
    {
      n: 2, date: '2026-10-18', label: '10/18', dow: '日', color: 'day2', theme: '訪問・奈良ドライブ',
      title: '桜井の親戚の家から、奈良の大仏さまへ',
      route: 'ホテル → 桜井市 → 奈良公園・東大寺 → ホテル',
      summary: '全20地点・19区間',
      /* 車の道順（Googleマップ）。経由地は、PDFしおりの行程表と環状線の略図の矢印の順（1本のリンクに最大9か所）。
         o：出発、d：到着、wp：経由地。行程表の車の区間は、dr で、どの道順に入るかを示す。
         経由地は、Googleマップで正しい地点になるかを確かめた書き方にする（2026-09-29）。名前では別の地点になる新庄ランプ・土佐堀ランプは、座標（道筋のデータと同じ点）で指す */
      drives: [
        { id: 'am', label: 'ホテル → 桜井（親戚の家）', when: '8:30〜9:41', o: 'からくさホテルグランデ新大阪タワー 大阪府大阪市淀川区宮原3-3-24', d: '奈良県桜井市忍阪310',
          wp: ['南森町入口', 'えびすJCT', '松原JCT', '美原JCT', '34.49896,135.73500'],
          via: '南森町ランプ → 阪神高速 環状線 → えびすJCT → 松原線 → 松原JCT → 阪和道 → 美原JCT → 南阪奈道路 → 新庄ランプ' },
        { id: 'noon', label: '桜井 → まるかつ天理店 → 奈良公園の駐車場', when: '12:00〜13:54', o: '奈良県桜井市忍阪310', d: 'タイムズ奈良公園南 奈良県奈良市高畑町1204',
          wp: ['まるかつ天理店 奈良県天理市杣之内町437-3'],
          via: '一般道。駐車場は第一候補のタイムズ奈良公園南にしています' },
        { id: 'eve', label: '奈良公園 → 環状線を一周 → ホテル', when: '16:20〜17:35', o: 'タイムズ奈良公園南 奈良県奈良市高畑町1204', d: 'からくさホテルグランデ新大阪タワー 大阪府大阪市淀川区宮原3-3-24',
          wp: ['第二阪奈道路 宝来ランプ', '東船場JCT', 'えびすJCT', '西船場JCT', '中之島JCT', '天神橋JCT', '東船場JCT', '西船場JCT', '34.69071,135.49651'],
          via: '宝来ランプ → 第二阪奈道路 → 西石切ランプ → 東大阪線 → 東船場JCT → 環状線を時計回りに一周（えびすJCT・湊町・西船場JCT・中之島JCT・天神橋JCT）→ 東船場JCTから近道して西船場JCT → 土佐堀ランプ' }
      ],
      items: [
        { t: 'stop', dep: '7:49', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', kind: 'start', note: 'レンタカーを受け取って、みんなを迎えに来るまでは昇平さんだけの行程' },
        { t: 'move', min: 6, mode: 'walk', line: '徒歩', dist: '362m' },
        { t: 'stop', arr: '7:55', dep: '8:10', name: 'ニッポンレンタカー 新大阪駅新幹線口', type: 'car', note: 'レンタカーを受け取る（予約は8:00〜20:00）', to: '#/stay/car' },
        { t: 'move', min: 5, mode: 'car', line: 'レンタカー', dist: '292m' },
        { t: 'stop', arr: '8:15', dep: '8:30', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', note: 'みんなをピックアップ' },
        { t: 'move', dr: 'am', min: 15, mode: 'car', line: 'レンタカー', dist: '4.8km' },
        { t: 'stop', arr: '8:45', name: '南森町ランプ', type: 'ramp', minor: 1 },
        { t: 'move', dr: 'am', min: 7, mode: 'highway', line: '阪神高速1号環状線', dist: '3.9km' },
        { t: 'stop', arr: '8:52', name: 'えびすJCT', type: 'ramp', minor: 1 },
        { t: 'move', dr: 'am', min: 15, mode: 'highway', line: '阪神高速14号松原線', dist: '12.1km' },
        { t: 'stop', arr: '9:07', name: '松原JCT', type: 'ramp', minor: 1 },
        { t: 'move', dr: 'am', min: 5, mode: 'highway', line: '阪和道', dist: '4.4km' },
        { t: 'stop', arr: '9:12', name: '美原JCT', type: 'ramp', minor: 1 },
        { t: 'move', dr: 'am', min: 14, mode: 'highway', line: '南阪奈道路', dist: '16.9km' },
        { t: 'stop', arr: '9:26', name: '新庄ランプ', type: 'ramp', minor: 1 },
        { t: 'move', dr: 'am', min: 15, mode: 'car', line: 'レンタカー', dist: '15.0km' },
        { t: 'stop', arr: '9:41', dep: '12:00', name: '親戚の家', type: 'visit', note: '10時ごろから訪問。奈良県桜井市忍阪310', map: '奈良県桜井市忍阪310', to: '#/spot/sakurai' },
        { t: 'move', dr: 'noon', min: 25, mode: 'car', line: 'レンタカー', dist: '12.1km' },
        { t: 'stop', arr: '12:25', dep: '13:30', name: 'まるかつ天理店', type: 'food', note: 'お昼ごはん（なら歴史芸術文化村内）', to: '#/food/marukatsu' },
        { t: 'move', dr: 'noon', min: 24, mode: 'car', line: 'レンタカー', dist: '11.9km' },
        { t: 'stop', arr: '13:54', dep: '14:00', name: '奈良公園近くの駐車場', type: 'parking', note: '第一候補はタイムズ奈良公園南。満車なら次の候補へ', to: '#/sos/parking' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '536m' },
        { t: 'stop', arr: '14:10', dep: '16:10', name: '奈良公園・東大寺', type: 'spot', note: '鹿と大仏さま。2時間のおさんぽ', to: '#/spot/todaiji' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '536m' },
        { t: 'stop', arr: '16:20', name: '奈良公園近くの駐車場', type: 'parking', minor: 1 },
        { t: 'move', dr: 'eve', min: 16, mode: 'car', line: 'レンタカー', dist: '8.0km' },
        { t: 'stop', arr: '16:36', name: '宝来ランプ', type: 'ramp', minor: 1 },
        { t: 'move', dr: 'eve', min: 16, mode: 'highway', line: '第二阪奈道路', dist: '13.4km' },
        { t: 'stop', arr: '16:52', name: '西石切ランプ', type: 'ramp', minor: 1 },
        { t: 'move', dr: 'eve', min: 14, mode: 'highway', line: '阪神高速13号東大阪線', dist: '11.6km' },
        { t: 'stop', arr: '17:06', name: '東船場JCT', type: 'ramp', minor: 1 },
        { t: 'move', dr: 'eve', min: 19, mode: 'highway', line: '阪神高速1号環状線', dist: '9.4km', note: '環状線をぐるっと一周する車窓観光', link: ['走るルート', '#/spot/loop'] },
        { t: 'stop', arr: '17:25', name: '土佐堀ランプ', type: 'ramp', minor: 1 },
        { t: 'move', dr: 'eve', min: 10, mode: 'car', line: 'レンタカー', dist: '5.8km' },
        { t: 'stop', arr: '17:35', dep: '17:45', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', note: 'みんなはここで降車。レンタカー返却は昇平さんだけ' },
        { t: 'move', min: 5, mode: 'car', line: 'レンタカー', dist: '279m' },
        { t: 'stop', arr: '17:50', dep: '18:05', name: 'ニッポンレンタカー 新大阪駅新幹線口', type: 'car', note: 'ガソリンを満タンにして返却', due: '20:00', dueName: 'レンタカーの返却（20:00まで）' },
        { t: 'move', min: 5, mode: 'walk', line: '徒歩', dist: '288m' },
        { t: 'stop', arr: '18:10', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', kind: 'goal' }
      ],
      dinner: '夕ごはんは、梅田か新大阪の候補から選びます。「きじ」は日曜定休なので、この日は行けません。'
    },
    {
      n: 3, date: '2026-10-19', label: '10/19', dow: '月', color: 'day3', theme: '大阪市内観光',
      title: '道頓堀から大阪城、夕方は展望テラスへ',
      route: 'ホテル → 道頓堀 → 大阪城公園 → ホテル → WowUs → ホテル',
      summary: '全20地点・19区間',
      items: [
        { t: 'stop', dep: '9:00', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', kind: 'start' },
        { t: 'move', min: 8, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '9:08', dep: '9:12', name: '新大阪', type: 'station', roma: 'Shin-Ōsaka', minor: 1, note: '最寄りの入口は4番口' },
        { t: 'move', min: 16, mode: 'metro', line: 'Osaka Metro 御堂筋線 なかもず行', detail: '1番ホーム・7・9両目／290円' },
        { t: 'stop', arr: '9:28', name: 'なんば', type: 'station', roma: 'Namba', minor: 1, note: '最寄りの出口は14番口' },
        { t: 'move', min: 12, mode: 'walk', line: '徒歩', dist: '384m' },
        { t: 'stop', arr: '9:40', dep: '10:10', name: '道頓堀', type: 'spot', note: '道頓堀のまわりをおさんぽ', to: '#/spot/dotonbori' },
        { t: 'move', min: 11, mode: 'walk', line: '徒歩', dist: '314m' },
        { t: 'stop', arr: '10:21', dep: '10:25', name: 'なんば', type: 'station', roma: 'Namba', minor: 1, note: '最寄りの入口は14番口' },
        { t: 'move', min: 3, mode: 'metro', line: 'Osaka Metro 千日前線 南巽行', detail: '1番ホーム・4両目／240円' },
        { t: 'stop', arr: '10:28', dep: '10:34', name: '谷町九丁目', type: 'station', roma: 'Tanimachi 9-chōme', minor: 1, note: '乗り換え' },
        { t: 'move', min: 3, mode: 'metro', line: 'Osaka Metro 谷町線 大日行', detail: '2番ホーム・1両目' },
        { t: 'stop', arr: '10:37', name: '谷町四丁目', type: 'station', roma: 'Tanimachi 4-chōme', minor: 1, note: '最寄りの出口は1-B口' },
        { t: 'move', min: 24, mode: 'walk', line: '徒歩', dist: '1.4km' },
        { t: 'stop', arr: '11:01', dep: '11:30', name: '大阪城・大阪城公園', type: 'spot', note: '公園をおさんぽ（天守閣の入館は予定に含めていません）', to: '#/spot/osakajo' },
        { t: 'move', min: 20, mode: 'walk', line: '徒歩', dist: '1.2km' },
        { t: 'stop', arr: '11:50', dep: '12:50', name: 'JO-TERRACE OSAKA', type: 'food', note: 'お昼ごはん。お店は現地で決める', to: '#/spot/osakajo' },
        { t: 'move', min: 6, mode: 'walk', line: '徒歩', dist: '222m' },
        { t: 'stop', arr: '12:58', dep: '13:02', name: '大阪城公園', type: 'station', roma: 'Ōsakajōkōen', minor: 1 },
        { t: 'move', min: 9, mode: 'jr', line: 'JR大阪環状線 大和路快速', detail: '1番ホーム・前のほうの車両／200円' },
        { t: 'stop', arr: '13:11', dep: '13:17', name: '大阪', type: 'station', roma: 'Ōsaka', minor: 1, note: '乗り換え' },
        { t: 'move', min: 3, mode: 'jr', line: 'JR京都線 各駅停車 高槻行', detail: '7番ホーム・中ほどの車両' },
        { t: 'stop', arr: '13:20', name: '新大阪', type: 'station', roma: 'Shin-Ōsaka', minor: 1, note: '最寄りの出口は6番口' },
        { t: 'move', min: 15, mode: 'walk', line: '徒歩', dist: '801m' },
        { t: 'stop', arr: '13:35', dep: '15:30', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', note: 'ホテルでひと休み（約2時間）' },
        { t: 'move', min: 7, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '15:37', dep: '15:41', name: '新大阪', type: 'station', roma: 'Shin-Ōsaka', minor: 1, note: '最寄りの入口は4番口' },
        { t: 'move', min: 10, mode: 'metro', line: 'Osaka Metro 御堂筋線 なかもず行', detail: '1番ホーム・10両目／240円' },
        { t: 'stop', arr: '15:51', name: '淀屋橋', type: 'station', roma: 'Yodoyabashi', minor: 1, note: '最寄りの出口は7番口' },
        { t: 'move', min: 11, mode: 'walk', line: '徒歩', dist: '528m' },
        { t: 'stop', arr: '16:02', dep: '16:30', name: '大阪堂島浜タワー WowUs', type: 'spot', note: '16階の無料展望テラス。※貸切や臨時休業の日があり、貸切の時間はテラスに入れません。当日、公式のお知らせを確認してください', to: '#/spot/wowus' },
        { t: 'move', min: 5, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '16:35', dep: '16:50', name: '中之島エリアをおさんぽ', type: 'spot', optional: 1, note: '日本銀行大阪支店など。時間と体力に余裕があれば' },
        { t: 'move', min: 9, mode: 'walk', line: '徒歩', dist: '446m' },
        { t: 'stop', arr: '16:59', dep: '17:03', name: '淀屋橋', type: 'station', roma: 'Yodoyabashi', minor: 1, note: '最寄りの入口は7番口' },
        { t: 'move', min: 9, mode: 'metro', line: 'Osaka Metro 御堂筋線 箕面萱野行', detail: '2番ホーム・1・3両目／240円' },
        { t: 'stop', arr: '17:12', name: '新大阪', type: 'station', roma: 'Shin-Ōsaka', minor: 1, note: '最寄りの出口は4番口' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '17:22', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', kind: 'goal' }
      ],
      dinner: '夕ごはんは、梅田か新大阪の候補から選びます。この日の地下鉄は1日乗車券（大人820円）の想定です。'
    },
    {
      n: 4, date: '2026-10-20', label: '10/20', dow: '火', color: 'day4', theme: '移動日',
      title: 'のぞみの世代違いを乗り比べて、帰路へ',
      route: 'ホテル → 新大阪駅 → 新大村駅',
      summary: '全5地点・4区間',
      items: [
        { t: 'stop', dep: '10:20', name: 'からくさホテルグランデ新大阪タワー', type: 'hotel', kind: 'start', note: 'チェックアウトは11:00まで', due: '11:00', dueAt: 'dep', dueName: 'チェックアウト（11:00まで）' },
        { t: 'move', min: 10, mode: 'walk', line: '徒歩', dist: '410m' },
        { t: 'stop', arr: '10:30', dep: '11:02', name: '新大阪', type: 'station', roma: 'Shin-Ōsaka', note: '発車まで約30分。お弁当やおみやげはここで' },
        { t: 'move', min: 148, mode: 'shinkansen', line: '山陽新幹線 のぞみ17号', train: 'nozomi17' },
        { t: 'stop', arr: '13:30', dep: '13:54', name: '博多', type: 'station', roma: 'Hakata', minor: 1, note: '乗り換え約24分' },
        { t: 'move', min: 60, mode: 'train', line: 'JR特急 リレーかもめ33号', train: 'relay33' },
        { t: 'stop', arr: '14:54', dep: '14:57', name: '武雄温泉', type: 'station', roma: 'Takeo-Onsen', minor: 1, note: '向かい側のホームへ対面乗り換え' },
        { t: 'move', min: 11, mode: 'shinkansen', line: '西九州新幹線 かもめ33号', train: 'kamome33' },
        { t: 'stop', arr: '15:08', name: '新大村', type: 'station', roma: 'Shin-Ōmura', kind: 'goal', note: 'おかえりなさい' }
      ]
    }
  ],

  /* ---------------- ごはん ---------------- */
  lunch: [
    {
      id: 'marukatsu', day: 2, when: '10/18（日）お昼 12:25〜13:30', name: 'まるかつ天理店', sub: '奈良名産レストラン＆CAFE',
      address: '奈良県天理市杣之内町437-3 なら歴史芸術文化村内', tel: '0743-86-4479',
      hours: '9:00〜20:30（L.O. 20:00）。9:00〜11:00は朝メニューのみ', pay: '支払い方法は現地で確認',
      url: 'https://marukatsu912.com/shoplist/tenri/',
      lead: 'とんかつに、奈良の銘柄豚「ヤマトポーク」と野菜のせいろ蒸しなどが付く「かつ膳」は、天理店だけの特別コース。',
      menu: [
        ['ヤマトポークかつ膳', 2760, '天理店限定。せいろ蒸し・大和まなの煮浸し・しじみ汁など付き', 1],
        ['ヤマトポーク ロースかつ定食（120g）', 1830, '奈良の銘柄豚', 1],
        ['ヒレかつ定食（120g）', 1740],
        ['ロースかつ定食（120g）', 1630],
        ['ミックス定食', 2360, 'ロースかつ80g・ヒレかつ60g・大えびフライ'],
        ['ロースコロ定食', 1430, 'ロースかつ80g・元祖まるかつコロッケ'],
        ['えびフライ定食（ダブル）', 1760],
        ['キッズ定食', 910, '中学生くらいまで。ヒレかつ・ウインナー・からあげなど'],
        ['おこさまプレート', 400, '小学生未満']
      ],
      note: 'ご飯（白ご飯か十五穀米）・キャベツ・しじみ汁はおかわり自由。揚げ物が残ったら、お持ち帰りパックを使えます。'
    }
  ],

  dinner: [
    { id: 'kiji', code: 'A-1', area: 'umeda', name: 'お好み焼き「きじ」本店', genre: 'お好み焼き', place: '新梅田食道街1F', address: '大阪府大阪市北区角田町9-20 新梅田食道街1F', tel: '06-6361-5804', hours: '月〜土 11:30〜21:30', closed: '日曜定休', closedDays: [0], cash: 1, pay: '現金のみ（カード・電子マネー・QR決済は不可）', url: 'https://tabelog.com/osaka/A2701/A270101/27000297/',
      picks: [['すじ玉', 1400, '牛すじをじっくり煮込んだ、人気No.1'], ['もだん焼', 1200, '生地を使わず、焼きそばを卵で包む'], ['豚玉', 1050, '']] },
    { id: 'hanadako', code: 'A-2', area: 'umeda', name: 'はなだこ', genre: 'たこ焼き', place: '新梅田食道街1F', address: '大阪府大阪市北区角田町9-26 新梅田食道街1F', tel: '06-6361-7518', hours: '10:00〜22:00', closed: '無休', cash: 1, pay: '現金のみ（カード不可）', url: 'https://tabelog.com/osaka/A2701/A270101/27012248/', takeout: 'たこ焼き・ネギマヨは持ち帰りできます（たこせんは店内のみ）',
      picks: [['ネギマヨ（6個）', 670, '人気No.1。8個860円・10個1,050円'], ['たこ焼き（6個）', 570, '8個760円・10個950円'], ['たこせん', 240, 'えびせんでたこ焼き2個をはさむ']] },
    { id: 'matsuba', code: 'A-3', area: 'umeda', name: '串かつ専門店 松葉 総本店', genre: '串かつ', place: '新梅田食道街1F', address: '大阪府大阪市北区角田町9-20 新梅田食道街1F', tel: '06-6312-6615', hours: '月〜土 11:00〜22:00／日・祝 11:00〜21:30', closed: '', pay: 'カード可（VISA・Master・JCB・AMEX・Diners）、交通系ICなど電子マネー可、QR決済は不可', url: 'https://meisei-matsuba.com/shop/honten/', rule: '目の前の串は自由に取って、会計は食べた串の本数で。ソースの二度づけは禁止。',
      picks: [['牛肉', 120, '人気No.1'], ['若鶏', 230, '人気No.2'], ['メガサイズえび', 300, '人気No.3']] },
    { id: 'messekuma', code: 'B-1', area: 'shinosaka', name: 'めっせ熊 新大阪店', genre: 'お好み焼き・ねぎ焼き', place: 'JR新大阪駅1F 味の小路', address: '大阪府大阪市淀川区西中島5-16-1 JR新大阪駅1F 味の小路内', tel: '06-6304-3418', hours: '11:00〜23:00（L.O. 料理22:10・ドリンク22:30）', closed: '年末年始のみ', pay: 'カード可（VISA・Master・JCB・AMEX・Diners）、電子マネー可、QR決済可（PayPay）', url: 'https://tabelog.com/osaka/A2701/A270301/27017718/',
      picks: [['ねぎおこ（豚）', 1380, 'ねぎ焼きとお好み焼きのいいとこどり'], ['牛すじ玉', 1380, '甘辛く煮込んだ牛すじとこんにゃくが自慢'], ['豚玉', 1130, '']] },
    { id: 'botejyu', code: 'B-2', area: 'shinosaka', name: 'ぼてぢゅう 新大阪駅店', genre: 'お好み焼き', place: 'JR新大阪駅構内2F', address: '大阪府大阪市淀川区西中島5丁目16-1 JR新大阪駅構内2F', tel: '06-6390-9080', hours: '10:00〜23:00（L.O. 22:00）', closed: '施設に準じる', pay: 'カード可、電子マネー可、QR決済可（PayPay・d払い・楽天ペイ・auPAYなど）', url: 'https://tabelog.com/osaka/A2701/A270301/27007878/',
      picks: [['元祖とん玉', 1298, '豚肉'], ['大阪ミックス玉', 1848, '豚肉・海老・いか'], ['たこ焼コンビ（6個）', 770, 'たこ焼とねぎたこ焼を3個ずつ']] },
    { id: 'wanaka', code: 'B-3', area: 'shinosaka', name: 'たこ焼道楽 わなか 新大阪駅店', genre: 'たこ焼き', place: 'JR新大阪駅2F アルデ新大阪', address: '大阪府大阪市淀川区西中島5-16-1 JR新大阪駅2F アルデ新大阪', tel: '06-6307-2068', hours: '10:00〜21:00（L.O. 20:30）', closed: '', pay: 'カード可・電子マネー可・QR決済可', url: 'http://takoyaki-wanaka.com/#content04', takeout: '持ち帰りできます',
      picks: [['たこ焼き（8個）', 700, '12個1,050円。ネギ・チーズのトッピング各+100円'], ['おおいり（9個）', 950, 'ソース・ねぎ塩・麻婆ソースなど4種を一皿で'], ['たこせん', 300, 'わなか特製えび煎餅にたこ焼をはさむ']] },
    { id: 'daruma', code: 'B-4', area: 'shinosaka', name: '串かつだるま アルデ新大阪店', genre: '串かつ', place: 'JR新大阪駅2F アルデ新大阪', address: '大阪府大阪市淀川区西中島5-16-1 JR新大阪駅2階 アルデ新大阪', tel: '06-4805-8844', hours: '10:30〜22:30（L.O. 30分前）', closed: '年中無休', pay: 'カード可、電子マネー可（ICOCA・Suicaなど）、QR決済可（PayPay・d払いなど）', url: 'https://www.kushikatu-daruma.com/location/arude_shinosaka', takeout: '持ち帰りはセットのみ（容器代・ソース代込み）',
      picks: [['持ち帰り 串かつ8本セット', 1310, '元祖串かつ3本・キス・ウインナー・アスパラ'], ['持ち帰り 串かつ10本セット', 1761, '天然えび・うずら卵・鳥つくねなど'], ['持ち帰り 串かつ12本セット', 2058, '紅しょうが・キスまで入った全部のせ']] }
  ],
  dinnerAreas: {
    umeda: { name: '梅田エリア', sub: '大阪駅すぐの「新梅田食道街」。昔ながらの横丁です。', map: '新梅田食道街' },
    shinosaka: { name: '新大阪エリア', sub: 'ホテルから歩いてすぐ、JR新大阪駅の中。', map: 'JR新大阪駅 アルデ新大阪' }
  },

  /* ---------------- おでかけ ---------------- */
  spots: [
    { id: 'osakastation', day: 1, when: '10/17（土）16:30〜17:30', name: '大阪ステーションシティ', area: '大阪・梅田', kana: 'おおさかステーションシティ',
      lead: '大阪駅の上と周りに広がる、関西でも指折りの商業エリア。LUCUA 1100は開業当時、全国初・関西初・梅田初出店の店が約6割を占めました。',
      info: [['住所', '大阪市北区梅田3-1-3'], ['営業', 'LUCUA 10:30〜20:30（ダイニング11:00〜23:00）、LUCUA 1100 10:30〜20:30。ほかは施設ごと'], ['予定', '梅田駅8番口から徒歩11分（258m）。滞在1時間']],
      url: 'https://osakastationcity.com/', map: '大阪ステーションシティ' },
    { id: 'sakurai', day: 2, when: '10/18（日）9:41〜12:00', name: '桜井（親戚の家）', area: '奈良・桜井', kana: 'さくらい',
      lead: '三輪山のふもと、日本最古の道「山の辺の道」が通る町。そうめんや相撲の始まりの物語が残っています。',
      info: [['住所', '奈良県桜井市忍阪310'], ['予定', '10時ごろから訪問']], map: '奈良県桜井市忍阪310', trivia: ['sakurai1', 'sakurai2'] },
    { id: 'todaiji', day: 2, when: '10/18（日）14:10〜16:10', name: '東大寺・奈良公園', area: '奈良', kana: 'とうだいじ・ならこうえん',
      lead: '大仏殿（世界最大級の木造建築）、盧舎那仏（奈良の大仏）、南大門の金剛力士像が見どころ。公園には約1,700頭の鹿がいます。',
      info: [['住所', '奈良県奈良市雑司町406-1'], ['電話', '0742-22-5511'], ['大仏殿', '4〜10月 7:30〜17:30'], ['法華堂・戒壇堂', '8:30〜16:00'], ['東大寺ミュージアム', '4〜10月 9:30〜17:30（最終入館17:00）'], ['休み', 'なし']],
      fees: [['大仏殿', '大人800円（中学生以上）・小学生400円'], ['大仏殿＋ミュージアム', '大人1,200円・小学生600円']],
      walk: ['駐車場', '浮雲園地（鹿）', '南大門', '大仏殿', '同じ園路で戻る'],
      walkNote: '往復で約5km歩く目安。階段を避けて、広い園路や参道を選びます。砂利や石畳では無理せず抱っこに切り替え。鹿のいる場所は日によって変わります。',
      warn: '奈良公園の鹿は人に慣れていますが、野生動物です。むやみに触ったり、食べ物を見せたりしないようにしましょう。',
      url: 'https://www.pref.nara.lg.jp/site/park/index.html', map: '東大寺 大仏殿', trivia: ['nara1', 'nara2'],
      maps: [['奈良公園マップ（奈良県）', 'https://www.pref.nara.jp/57798.htm']] },
    { id: 'loop', day: 2, when: '10/18（日）17:06〜17:25', name: '阪神高速 環状線ドライブ', area: '大阪市内', kana: 'はんしんこうそく かんじょうせん',
      lead: '奈良からの帰り道、阪神高速1号環状線を時計回りに一周。車窓から大阪の高層ビルや大阪城を眺めます（見えるとは限りません）。',
      steps: ['東船場JCTから阪神高速1号環状線に入る', '時計回りに環状線を一周', '東船場JCT付近まで戻ったら一周完了', 'そのまま近道して、土佐堀ランプから出る'],
      info: [['区間', '東船場JCT 17:06 → 土佐堀ランプ 17:25'], ['距離', '9.4km・約19分']],
      warn: '運転する人は景色を見ずに運転に集中。景色は同乗者の楽しみです。',
      links: [['環状線あんぜん走行MAP', 'https://www.hanshin-exp.co.jp/drivers/driver/files/anzenmap202203.pdf'], ['環状線案内図', 'https://www.hanshin-exp.co.jp/drivers/ryoukin/images/amap_osaka.pdf']] },
    { id: 'dotonbori', day: 3, when: '10/19（月）9:40〜10:10', name: '道頓堀', area: '大阪・ミナミ', kana: 'どうとんぼり',
      lead: 'グリコサインなど巨大な立体看板が並ぶ、大阪らしさのかたまりのような通り。川沿いには遊歩道「とんぼりリバーウォーク」があります。',
      info: [['住所', '大阪市中央区道頓堀'], ['電話', '06-6211-4542（道頓堀商店会事務局）'], ['行き方', 'なんば駅14番出口から徒歩約12分（384m）']],
      url: 'https://osaka-info.jp/spot/dotonbori/', map: '道頓堀 グリコサイン', trivia: ['osaka'] },
    { id: 'osakajo', day: 3, when: '10/19（月）11:01〜12:50', name: '大阪城公園とJO-TERRACE OSAKA', area: '大阪・大阪城', kana: 'おおさかじょうこうえん',
      lead: '大阪城を眺めながら公園をおさんぽして、公園内の「JO-TERRACE OSAKA」でお昼ごはん。天守閣の入館などの有料施設は予定に入れていません。',
      info: [['公園', '11:01着・11:30発。谷町四丁目駅から徒歩24分（1.4km）'], ['お昼', '11:50〜12:50。JO-TERRACE OSAKA（大阪市中央区大阪城3-1）。お店は現地で決める'], ['そのあと', '大阪城公園駅からJRで新大阪へ戻り、ホテルで休憩']],
      urls: [['大阪城公園', 'https://www.osakacastlepark.jp/?lang=ja'], ['JO-TERRACE OSAKA', 'https://jo-terrace.jp/']], map: '大阪城公園',
      maps: [['大阪城公園MAP（PDF）', 'https://www.osakacastlepark.jp/pdf/osakacastlemap_2025.pdf']] },
    { id: 'wowus', day: 3, when: '10/19（月）16:02〜16:30', name: '大阪堂島浜タワー WowUs', area: '大阪・中之島', kana: 'ワオアス',
      lead: '16階から大阪の街並みを眺められる、無料の展望スポット。見学のあと、時間と体力に余裕があれば中之島エリアを15分ほどおさんぽ。',
      info: [['住所', '大阪市北区堂島浜1丁目1-27 大阪堂島浜タワー16階'], ['営業', '屋内 9:00〜21:00、ウッドデッキテラス 8:00〜21:00'], ['休み', '不定休。貸切・臨時休業の有無は当日確認'], ['入場', '無料'], ['行き方', '淀屋橋駅7番出口から徒歩11分（528m）']],
      warn: '※貸切や臨時休業の日があり、貸切の時間はテラスに入れません。当日、下の「公式の情報」でお知らせを確認してください。',
      url: 'https://www.wow-us.jp/', map: '大阪堂島浜タワー' }
  ],

  trivia: {
    osaka: { title: '道頓堀で見つける、大阪の小ネタ', cards: [
      ['道頓堀', 'グリコサインは現在6代目', '初代は1935年。今の6代目は2014年10月に設置され、高さ20m、約14万個のLEDで輝きます。'],
      ['地名の由来', '「道頓堀」は人の名前', '1612年、安井道頓が私財を投じて川の開削を始めました。完成後、その功績をたたえて「道頓堀」と名づけられました。'],
      ['大阪グルメ', '551の最初の名物はカレー', '1945年、蓬莱食堂が最初に出したのはカレーライス。1皿10円、同じ10円でビール5本やサンマ3匹が買えた時代でした。'],
      ['ことば', '「肉まん」ではなく「豚まん」', '大阪の豚まんの老舗・蓬莱本館は、創業のころは牛肉や鶏肉のまんじゅうもあったため、豚肉入りとはっきり分かるよう「豚まん」と呼んだ、と説明しています。関西では「肉」といえば牛肉を思い浮かべる人が多いことも、この呼び名が根づいた背景です。']
    ] },
    sakurai1: { title: '山そのものが、神社の本殿', big: ['467m', '三輪山の標高'], cards: [
      ['大神神社', 'ご神体は建物ではなく三輪山', '神さまが三輪山に鎮まると考えるため、本殿を置きません。拝殿の奥の三ツ鳥居を通して、山へ直接祈ります。周囲約16km、神域約350ha。'],
      ['三ツ鳥居', '山の扉', '3つの明神鳥居を横につないだ独特の形。三輪山を本殿と見立てたときの「本殿の扉」の役目とも説明されています。'],
      ['杉玉', '酒屋の杉玉は、三輪がルーツ', '三輪山の杉は神聖な木。大神神社が授ける杉玉は、酒造りの守護を願う印として酒蔵や酒店の軒先に広まりました。'],
      ['ひとこと', '「日本最古」の意味', '社殿が古いのではなく、山を神体として拝む古い祭祀の形を伝えている、という意味です。']
    ], note: '大神神社は今回の行程には入っていません。' },
    sakurai2: { title: '道・市・食・相撲が交わる町', big: ['1300年超', '三輪そうめんの歴史'], cards: [
      ['三輪そうめん', 'そうめん発祥の地とされる三輪', '三輪山のふもとで穀物を粉にし細くのばす食が生まれた、という伝承が残ります。伊勢参りの人々が製法を持ち帰り、播州・小豆島・島原へ広がったとも。'],
      ['古道と市場', '日本最古の道と、日本最古の市場', '桜井から奈良へ続く「山の辺の道」は日本最古の道とされます。起点近くの海柘榴市（つばいち）は古道が交わる場所に生まれた、日本最古の市とされます。'],
      ['都', '都が何度も置かれた場所', '桜井市内には、記紀ゆかりの宮跡の伝承地が数多く残ります。飛鳥より前の政治の舞台が、何度も桜井周辺に置かれました。'],
      ['相撲', '相撲の初戦は、蹴りあり', '『日本書紀』の野見宿禰と当麻蹶速の勝負が相撲の始まりの物語。蹴りも使う激しい勝負でした。舞台とされる纒向には相撲神社が残ります。']
    ] },
    nara1: { title: '鹿は、朝夕に通勤する野生動物', big: ['約1,700頭', '奈良公園の鹿（2026年7月の調査では1,687頭）'], cards: [
      ['国の天然記念物', '近い。でも、ペットではない', '人に慣れていても、野生動物です。春日大社の祭神が白鹿に乗って来たという伝承から、神の使いとして大切にされてきました。'],
      ['1日のリズム', '鹿にも「出勤」と「帰宅」がある', '朝は日の出ごろに寝場所から草のある食べ場所へ。昼は休み場所でのんびり過ごし、夕方に草を食べながら寝場所へ戻って、反すうしながら夜を過ごします。'],
      ['鹿せんべい', '鹿せんべいは砂糖なし', '原料は米ぬかと小麦粉だけ。紙の証紙を外して1枚ずつ素早くあげ、なくなったら両手を開いて見せます。証紙の売上は、鹿の保護の活動に使われます。'],
      ['角切り', '約350年続く伝統行事', '人と鹿が近く暮らす町だから生まれた、事故を防ぐための行事。江戸時代から続いています。']
    ] },
    nara2: { title: '大きさだけじゃない、奈良公園と大仏', big: ['14.98m', '大仏の座高。耳の長さ2.54m・手のひら1.48m'], cards: [
      ['造立', 'のべ約260万人が関わった', '752年の開眼供養に向けて、当時の人口の約半分にあたる人々が協力したと紹介されています。'],
      ['4時代の合作', 'いまの大仏は、奈良時代のままではない', '火災や兵火で損傷し、何度も修理・再鋳造されました。今の大仏には奈良・鎌倉・室町・江戸の各時代の部分が共存しています。'],
      ['奈良公園', '門のない巨大公園、約511ha', '明治13年（1880年）に開かれた都市公園で、面積は約511ha。塀や門も入園料もなく、いつでも歩けます。明治より前は、多くが興福寺の境内でした。'],
      ['世界遺産', '8つでひとつの世界遺産', '寺院・神社・平城宮跡・春日山原始林の8資産で「古都奈良の文化財」という1つの世界遺産になっています。']
    ] }
  },

  /* スタンプ */
  stamps: [
    { id: 'osakastation', name: '大阪駅', day: 1, mark: '梅' },
    { id: 'relative', name: '親戚の家', day: 2, mark: '桜' },
    { id: 'marukatsu', name: 'まるかつ', day: 2, mark: '膳' },
    { id: 'deer', name: '鹿に会えた', day: 2, mark: '鹿' },
    { id: 'daibutsu', name: '大仏さま', day: 2, mark: '仏' },
    { id: 'loop', name: '環状線一周', day: 2, mark: '環' },
    { id: 'dotonbori', name: '道頓堀', day: 3, mark: '道' },
    { id: 'osakajo', name: '大阪城', day: 3, mark: '城' },
    { id: 'wowus', name: 'WowUs', day: 3, mark: '空' },
    { id: 'castle', name: '車窓の城', day: 4, mark: '白' }
  ],

  /* ---------------- もしも ---------------- */
  sos: {
    urgent: [['119', '救急車・消防', '意識がない、呼吸がおかしいなど、明らかに緊急なら迷わず。'], ['110', '事件・交通事故', 'けが人がいれば119も。']],
    consult: [
      { label: '救急車を呼ぶ？ 病院へ行く？ 迷ったら', short: '#7119', rows: [['大阪', '救急安心センターおおさか', '06-6582-7119', '24時間・365日'], ['奈良', '奈良県救急安心センター', '0744-20-0119', '24時間・365日']] },
      { label: '子どもの急病（おおむね15歳未満）で迷ったら', short: '#8000', rows: [['大阪', '小児救急電話相談', '06-6765-3650', '19:00〜翌8:00・365日'], ['奈良', '小児救急電話相談', '0742-20-8119', '平日18:00〜翌8:00／土13:00〜翌8:00／日祝8:00〜翌8:00']] }
    ],
    hospitals: [
      { area: '大阪', name: '淀川キリスト教病院', address: '大阪市東淀川区柴島1丁目7番50号', tel: '0120-364-489', tel2: '0570-003-489', badge: 'YCHこども救急24', text: '小学生以下の内科的な病気（発熱・嘔吐・下痢など）を小児科医が24時間対応。原則、けが・頭部打撲は対象外。事前の電話は不要です。', url: 'https://www.ych.or.jp/shinryou/outpatient/night/' },
      { area: '奈良', name: '天理よろづ相談所病院「憩の家」', address: '奈良県天理市三島町200番地', tel: '0743-63-5611', badge: '救急外来', text: '24時間365日体制。救急外来を受診したいときは、必ず先に電話で連絡します。', url: 'https://www.tenriyorozu.jp/gairai/kyukyu-3/' }
    ],
    bring: ['マイナ保険証 または 健康保険の資格確認書', 'お薬手帳・飲んでいる薬の情報', '乳幼児は母子健康手帳（あれば）'],
    accident: ['安全を確保して、けが人を救護', '必要なら119', '110に連絡', 'レンタカー会社に連絡'],
    navi: 'https://www.iryou.teikyouseido.mhlw.go.jp/znk-web/juminkanja/S2300/initialize',
    note: '#7119・#8000がつながりにくいときは、並べて書いた通常の番号へ。#8000は奈良県では旅行者が使えるか公式情報で明確でないため、必要に応じて#7119も使います。このページは医学的な判断ではなく、相談窓口や病院検索につなぐためのものです。'
  },

  parking: {
    rule: '出発前に①の空き状況を確認。満車なら②へ直行。17時近くは③を避けて、②か④を選びます。',
    list: [
      { no: '①', name: 'タイムズ奈良公園南', spaces: '9台', open: '24時間', fee: '日曜 30分200円、当日最大1,000円（24時まで・繰り返し）', note: '台数が少ないので、出発前に空きを確認。高畑町交差点のTimesの看板と、左折で入る入口が目印。奈良市高畑町1204', nav: 'https://maps.app.goo.gl/GQAReJyxqbexKjgX8', live: 'https://times-info.net/P29-nara/C201/park-detail-BUK0050592/', first: 1 },
      { no: '②', name: '奈良登大路自動車駐車場', spaces: '275台', open: '6:00〜22:00', fee: '10/17・18は特定日で、当日最大3,000円（2026/10/1 改定）', note: '南大門まで約15分。台数が多く、いちばん頼れる予備。県営3駐車場の料金は10/1に変わりました。平日の「入庫後1時間無料」は、土日の旅行日には使えません。細かい料金は、下の公式ページで確認してください。', src: ['奈良県「県営自動車駐車場の料金改定について」', 'https://www.pref.nara.lg.jp/n111/p060008.html'], nav: 'https://www.google.com/maps/dir/?api=1&destination=%E5%A5%88%E8%89%AF%E7%99%BB%E5%A4%A7%E8%B7%AF%E8%87%AA%E5%8B%95%E8%BB%8A%E9%A7%90%E8%BB%8A%E5%A0%B4&travelmode=driving' },
      { no: '③', name: '興福寺駐車場', spaces: '46台', open: '9:00〜17:00', fee: '乗用車1回2,000円', note: '西側から回りやすい。南大門まで約20分。17時に閉まるので帰りの時間に注意。', nav: 'https://www.google.com/maps/dir/?api=1&destination=%E8%88%88%E7%A6%8F%E5%AF%BA%E9%A7%90%E8%BB%8A%E5%A0%B4%20%E5%A5%88%E8%89%AF%E5%B8%82%E7%99%BB%E5%A4%A7%E8%B7%AF%E7%94%BA48&travelmode=driving' },
      { no: '④', name: 'タイムズならまち', spaces: '132台', open: '24時間', fee: '土日祝 20分220円（8:00〜20:00）、当日最大1,800円', note: '歩く距離は長め。一部の枠は予約できます。', nav: 'https://www.google.com/maps/dir/?api=1&destination=%E3%82%BF%E3%82%A4%E3%83%A0%E3%82%BA%E3%81%AA%E3%82%89%E3%81%BE%E3%81%A1%20%E5%A5%88%E8%89%AF%E5%B8%82%E9%AB%98%E7%95%91%E7%94%BA1112&travelmode=driving', live: 'https://times-info.net/P29-nara/C201/park-detail-BUK0031256/' }
    ]
  },

  /* ---------------- お金 ---------------- */
  budget: {
    total: 432040,
    groups: [
      { name: '交通費', note: '早得予約運賃', sum: 177440, rows: [
        ['1日目 新大村→博多', '早得7／大人4名@3,400・子ども2名@1,700', 17000],
        ['1日目 博多→新大阪', 'EX早得7／大人4名@13,600・子ども2名@6,800', 68000],
        ['4日目 新大阪→博多', 'EX早特7／大人2名@13,600', 27200],
        ['4日目 新大阪→博多', 'EX通常／大人2名@15,820・子ども2名@7,900', 47440],
        ['4日目 博多→新大村', '早得7／大人4名@3,400・子ども2名@1,700', 17000]] },
      { name: '宿泊費', note: '確定予約の実額', sum: 182000, rows: [['飯塚家4名（大人2・子ども2）', '朝食付・2部屋・3泊', 107450], ['山口家2名（大人2）', '朝食付・1部屋・3泊', 74550]] },
      { name: 'レンタカー関連', note: '', sum: 21400, rows: [['レンタカー', 'ミニバンクラス', 15730], ['ETC', '高速・有料道路', 2670], ['ガソリン代', 'ノア想定', 2000], ['駐車代', '奈良公園近くのコインパーキング', 1000]] },
      { name: '食費', note: '子ども2名分は含めず', sum: 46000, rows: [['1日目 朝食', '新幹線車内／@1,000', 4000], ['2〜3日目 昼食', '@1,500×2日', 12000], ['4日目 昼食', '@1,500', 6000], ['1〜2日目 夕食', '@2,000×2日', 16000], ['3日目 夕食', '@2,000', 8000]] },
      { name: '乗車券・入場料', note: '子ども2名分は含めず', sum: 6000, rows: [['1日目 地下鉄', '大人4名@480（子どもは無料）', 1920], ['3日目 地下鉄1日乗車券', '大人4名@820', 3280], ['3日目 JR大阪城公園→新大阪', '大人4名@200', 800]] }
    ],
    families: [
      ['交通費', 109040, 68400, '人数で按分。復路のぞみは除く（子ども2名は飯塚家分）'],
      ['宿泊費', 107450, 74550, '確定予約の実額'],
      ['レンタカー関連', 10700, 10700, '2家族で折半'],
      ['食費', 23000, 23000, '2家族で折半'],
      ['乗車券・入場料', 2600, 2600, '大人4名で按分・子どもは無料']
    ],
    famTotal: { iizuka: 252790, yamaguchi: 179250 }
  },

  /* ---------------- 外部の地図・乗換案内（行程表の各区間の小さなリンク） ----------------
     Googleマップ：施設は正式名称と住所で、駅は駅名で指定する。Yahoo!乗換案内：駅名（yj が無ければ行程表の名前のまま） */
  places: {
    'からくさホテルグランデ新大阪タワー': { q: 'からくさホテルグランデ新大阪タワー 大阪府大阪市淀川区宮原3-3-24' },
    'ニッポンレンタカー 新大阪駅新幹線口': { q: 'ニッポンレンタカー 新大阪駅新幹線口営業所 大阪府大阪市淀川区西宮原1-2-58' },
    '新大阪': { q: '新大阪駅' },
    '梅田': { q: '梅田駅 大阪メトロ御堂筋線' },
    '大阪ステーションシティ': { q: '大阪ステーションシティ 大阪府大阪市北区梅田3-1-3' },
    'なんば': { q: 'なんば駅 大阪メトロ御堂筋線' },
    '道頓堀': { q: 'グリコサイン 大阪府大阪市中央区道頓堀1丁目' },
    '谷町四丁目': { q: '谷町四丁目駅' },
    '大阪城・大阪城公園': { q: '大阪城天守閣 大阪府大阪市中央区大阪城1-1' },
    'JO-TERRACE OSAKA': { q: 'JO-TERRACE OSAKA 大阪府大阪市中央区大阪城3-1' },
    '大阪城公園': { q: 'JR大阪城公園駅' },
    '淀屋橋': { q: '淀屋橋駅' },
    '大阪堂島浜タワー WowUs': { q: '大阪堂島浜タワー 大阪府大阪市北区堂島浜1-1-27' },
    '中之島エリアをおさんぽ': { q: '日本銀行大阪支店 大阪府大阪市北区中之島2-1-45' },
    '奈良公園近くの駐車場': { q: 'タイムズ奈良公園南 奈良県奈良市高畑町1204' },
    '奈良公園・東大寺': { q: '東大寺 南大門 奈良県奈良市雑司町406-1' }
  },

  /* ---------------- 公式の案内図（PDFしおりに載せていた地図・案内図） ---------------- */
  officialMaps: [
    { name: '博多駅の構内図', by: 'JRおでかけネット', url: 'https://www.jr-odekake.net/eki/premises?id=0910127', when: '10/17・10/20 乗り換え' },
    { name: '新大阪駅の構内図', by: 'JRおでかけネット', url: 'https://www.jr-odekake.net/eki/premises?id=0610155', when: '10/17・10/20' },
    { name: 'Osaka Metro 路線図', by: 'Osaka Metro', url: 'https://subway.osakametro.co.jp/guide/routemap.php', when: '10/17・10/19' },
    { name: '奈良公園マップ', by: '奈良県', url: 'https://www.pref.nara.jp/57798.htm', when: '10/18', spot: 'todaiji' },
    { name: '大阪城公園MAP（PDF）', by: '大阪城公園', url: 'https://www.osakacastlepark.jp/pdf/osakacastlemap_2025.pdf', when: '10/19', spot: 'osakajo' }
  ],

  /* ---------------- 読みにくい地名・駅名（ルビ。しおり内の検索でも、この読みで探せる） ----------------
     読みは、駅は鉄道会社、地名は自治体・施設の公式な表記に合わせた */
  ruby: [
    ['厚狭', 'あさ'], ['相生', 'あいおい'], ['新大村', 'しんおおむら'], ['武雄温泉', 'たけおおんせん'],
    ['箕面萱野', 'みのおかやの'], ['南巽', 'みなみたつみ'], ['大日', 'だいにち'],
    ['忍阪', 'おっさか'], ['杣之内町', 'そまのうちちょう'], ['雑司町', 'ぞうしちょう'], ['高畑町', 'たかばたけちょう'], ['登大路', 'のぼりおおじ'],
    ['浮雲園地', 'うきぐもえんち'], ['三輪山', 'みわやま'], ['大神神社', 'おおみわじんじゃ'], ['纒向', 'まきむく'],
    ['柴島', 'くにじま'], ['角田町', 'かくだちょう'], ['宝来', 'ほうらい'], ['西石切', 'にしいしきり'], ['東船場', 'ひがしせんば'], ['土佐堀', 'とさぼり'],
    ['淀屋橋', 'よどやばし'], ['堂島浜', 'どうじまはま']
  ],
  /* しおり内の検索用の読み（ひらがなでも探せるように。ルビの読みも使う） */
  yomi: {
    新大阪: 'しんおおさか', 大阪: 'おおさか', 梅田: 'うめだ', 難波: 'なんば', 奈良: 'なら', 東大寺: 'とうだいじ', 大仏: 'だいぶつ', 鹿: 'しか', 桜井: 'さくらい', 天理: 'てんり',
    博多: 'はかた', 小倉: 'こくら', 広島: 'ひろしま', 岡山: 'おかやま', 福山: 'ふくやま', 三原: 'みはら', 姫路: 'ひめじ', 新神戸: 'しんこうべ', 新下関: 'しんしものせき', 新山口: 'しんやまぐち', 徳山: 'とくやま', 新岩国: 'しんいわくに', 東広島: 'ひがしひろしま', 新尾道: 'しんおのみち', 新倉敷: 'しんくらしき', 西明石: 'にしあかし',
    谷町四丁目: 'たにまちよんちょうめ', 中之島: 'なかのしま', 大阪城: 'おおさかじょう', 城: 'しろ', 環状線: 'かんじょうせん', 阪神高速: 'はんしんこうそく', 新庄: 'しんじょう', 松原: 'まつばら',
    新幹線: 'しんかんせん', 特急: 'とっきゅう', 地下鉄: 'ちかてつ', 御堂筋線: 'みどうすじせん', 千日前線: 'せんにちまえせん', 谷町線: 'たにまちせん', 時刻表: 'じこくひょう', 乗り換え: 'のりかえ', 乗換: 'のりかえ',
    指定席: 'していせき', 座席: 'ざせき', 駅弁: 'えきべん', 弁当: 'べんとう', 車窓: 'しゃそう', 駐車場: 'ちゅうしゃじょう', 駐車: 'ちゅうしゃ',
    お好み焼き: 'おこのみやき', お好み焼: 'おこのみやき', 焼き: 'やき', 串かつ: 'くしかつ', 豚玉: 'ぶたたま', 夕ごはん: 'ゆうごはん', 朝ごはん: 'あさごはん', 昼: 'ひる', 食: 'しょく',
    予算: 'よさん', 割り勘: 'わりかん', 持ち物: 'もちもの', 緊急: 'きんきゅう', 連絡先: 'れんらくさき', 病院: 'びょういん', 救急: 'きゅうきゅう', 事故: 'じこ', 電話: 'でんわ',
    思い出: 'おもいで', 天気: 'てんき', 予報: 'よほう', 使い方: 'つかいかた', 文字: 'もじ', 合言葉: 'あいことば', 予約: 'よやく', 番号: 'ばんごう', 大浴場: 'だいよくじょう', 部屋: 'へや',
    家族: 'かぞく', 目次: 'もくじ', 地図: 'ちず', 道順: 'みちじゅん', 公園: 'こうえん', 神社: 'じんじゃ', 寺: 'てら', 世界遺産: 'せかいいさん', 展望: 'てんぼう', 散歩: 'さんぽ', 雨: 'あめ', 傘: 'かさ',
    充電: 'じゅうでん', 免許証: 'めんきょしょう', 保険証: 'ほけんしょう', 薬: 'くすり', 現金: 'げんきん', 支払い: 'しはらい', 構内図: 'こうないず', 案内図: 'あんないず', 路線図: 'ろせんず', 見どころ: 'みどころ', 名物: 'めいぶつ'
  },

  /* ---------------- トリビアのページ（#/trivia） ----------------
     分類ごとにまとめる。rail・nara・osaka は、のりもの・おでかけにあるトリビア（railTrivia・LINE.passing・trivia）もここに集める。
     出典は、公式サイト・自治体・博物館・鉄道会社・公的な資料で確かめたもの（2026-09-28・09-29確認）。出典のリンクが無いトリビアは載せない（ページにも出さない） */
  triviaCats: [
    { id: 'rail', name: '新幹線・鉄道', sub: 'のぞみ・かもめ・リレーかもめ', days: [1, 4] },
    { id: 'kyushu', name: '九州・西九州', sub: '出発の新大村から博多まで', days: [1, 4] },
    { id: 'nara', name: '桜井・奈良', sub: '三輪山のふもとと、奈良公園', days: [2] },
    { id: 'osaka', name: '大阪', sub: '道頓堀・大阪城・環状線・中之島', days: [1, 2, 3] },
    { id: 'line', name: '沿線の町', sub: '新大阪〜博多の車窓から', days: [1, 4] }
  ],
  /* のりもの・おでかけのトリビアの出典（キーはカードの data-tv） */
  triviaSrc: {
    'rail-0-0': [['N700S（JR東海）', 'https://railway.jr-central.co.jp/train/shinkansen/n700s/']],
    'rail-0-1': [['N700S「かもめ」と西九州新幹線（JR九州・日本アルミニウム協会の講演資料）', 'https://www.aluminum.or.jp/railway_vehicle/meeting/19/files/19_04.pdf']],
    'rail-0-2': [['N700S（JR東海）', 'https://railway.jr-central.co.jp/train/shinkansen/n700s/']],
    'rail-1-0': [['787系運行開始30周年（JR九州の報道資料）', 'https://www.jrkyushu.co.jp/news/__icsFiles/afieldfile/2022/06/21/220621_787_30th_kinengou.pdf']],
    'rail-1-2': [['主なデザイン関連受賞歴（JR九州）', 'https://www.jrkyushu.co.jp/company/info/history/history_award.html']],
    'rail-0-3': [['西九州新幹線車両デザイン決定（JR九州の報道資料）', 'https://www.jrkyushu.co.jp/news/__icsFiles/afieldfile/2021/07/28/210728_nishikyusyu_design.pdf']],
    'rail-1-1': [['787系の特別運行（JR九州の報道資料）', 'https://www.jrkyushu.co.jp/news/__icsFiles/afieldfile/2021/11/17/211117_787_tokubetu_unkou.pdf']],
    'rail-1-3': [['車両の紹介（JR九州 36ぷらす3）', 'https://www.jrkyushu-36plus3.jp/about/787/']],
    'rail-2-0': [['N700S（JR東海）', 'https://railway.jr-central.co.jp/train/shinkansen/n700s/']],
    'rail-2-1': [['N700S（JR東海）', 'https://railway.jr-central.co.jp/train/shinkansen/n700s/']],
    'rail-2-2': [['N700系・N700A（JR東海）', 'https://railway.jr-central.co.jp/train/shinkansen/detail_01_01/']],
    'rail-2-3': [['東海道・山陽新幹線から来春300系が引退します（JR東海）', 'https://jr-central.co.jp/news/release/nws000874.html'], ['同（JR西日本）', 'https://www.westjr.co.jp/press/article/2011/10/page_921.html']],
    'pass-0': [['山陽新幹線のトンネル数と延長（JR西日本の報道資料）', 'https://www.westjr.co.jp/press/article/items/161221_00_tuushin.pdf']],
    'osaka-0': [['6代目「道頓堀グリコサイン」完成（江崎グリコ）', 'https://www.glico.com/jp/newscenter/pressrelease/9609/']],
    'osaka-1': [['道頓堀（大阪観光局）', 'https://osaka-info.jp/spot/dotonbori/']],
    'osaka-2': [['551HORAIの歴史（551蓬莱）', 'https://www.551horai.co.jp/company/history/']],
    'osaka-3': [['よくあるご質問（蓬莱本館）', 'https://www.horaihonkan.co.jp/s/question.html']],
    'sakurai1-0': [['三輪山（大神神社）', 'https://oomiwa.or.jp/jinja/miwayama/'], ['大神神社について（大神神社）', 'https://oomiwa.or.jp/jinja/']],
    'sakurai1-1': [['三ツ鳥居と拝殿（大神神社）', 'https://oomiwa.or.jp/jinja/mitsudorii/']],
    'sakurai1-2': [['酒造りの神様 大神神社（奈良県）', 'https://www.pref.nara.jp/miryoku/ikasu-nara/seishu/oomiwa/']],
    'sakurai1-3': [['大神神社について（大神神社）', 'https://oomiwa.or.jp/jinja/']],
    'sakurai2-0': [['三輪そうめんの歴史（奈良県三輪素麺工業協同組合）', 'https://www.miwasoumen-kumiai.com/history/'], ['三輪そうめん（農林水産省 にっぽん伝統食図鑑）', 'https://www.maff.go.jp/j/keikaku/syokubunka/traditional-foods/menu/miwa_soumen.html']],
    'sakurai2-1': [['山の辺の道（奈良県観光公式サイト なら旅ネット）', 'https://yamatoji.nara-kankou.or.jp/03history/03old_road/03east_area/yamanobe_no_michi'], ['山の辺の道（桜井市観光協会）', 'https://sakuraikanko.com/modelcourse/yamanobenomichi/']],
    'sakurai2-2': [['宮跡めぐり（桜井市）', 'https://www.city.sakurai.lg.jp/sosiki/machidukuribu/kankouka/kankoujigyou/miyaatomeburi/index.html']],
    'sakurai2-3': [['相撲発祥の地（桜井市）', 'https://www.city.sakurai.lg.jp/sosiki/machidukuribu/kankouka/kankoujigyou/miyaatomeburi/1394261811958.html']],
    'nara1-0': [['奈良公園にはなぜ鹿がいる？（奈良市観光協会）', 'https://narashikanko.or.jp/feature/deer'], ['2026年 奈良公園のシカ生息頭数調査結果（奈良の鹿愛護会）', 'https://naradeer.com/blog/2026/07/16/cyousa/']],
    'nara1-1': [['奈良公園にはなぜ鹿がいる？（奈良市観光協会）', 'https://narashikanko.or.jp/feature/deer']],
    'nara1-2': [['鹿による人身事故啓発（奈良の鹿愛護会）', 'https://naradeer.com/learning/keihatsu.html']],
    'nara1-3': [['鹿の角きり（奈良の鹿愛護会）', 'https://naradeer.com/event/tsunokiri.html']],
    'nara2-0': [['大仏さまの全て（奈良市観光協会）', 'https://narashikanko.or.jp/feature/daibutsu']],
    'nara2-1': [['大仏さまの全て（奈良市観光協会）', 'https://narashikanko.or.jp/feature/daibutsu']],
    'nara2-2': [['奈良公園の概要（奈良県）', 'https://www3.pref.nara.jp/park/1000.htm'], ['奈良公園（奈良市観光協会）', 'https://narashikanko.or.jp/spot/detail_10089.html']],
    'nara2-3': [['古都奈良の文化財（文化遺産オンライン・文化庁）', 'https://online.bunka.go.jp/special_content/hlink7']]
  },
  /* このページで加えたトリビア：[分類の小見出し, 問い, 答え, 出典] */
  triviaMore: {
    kyushu: [
      ['西九州新幹線', '日本でいちばん短い新幹線', '西九州新幹線は、武雄温泉〜長崎の約66kmを結び、2022年9月23日に開業しました。途中の駅は嬉野温泉・新大村・諫早で、嬉野温泉と新大村は開業に合わせて新しくできた駅です。', [['西九州新幹線（武雄温泉・長崎間）（鉄道・運輸機構）', 'https://www.jrtt.go.jp/construction/achievement/westkyushu1.html']]],
      ['武雄温泉', '乗り換えは、同じホームの向かい側へ', '新幹線「かもめ」と在来線特急「リレーかもめ」は、武雄温泉駅の同じホームで向かい合わせに発着します。この「対面乗換」の所要時間は、約3分とされています。', [['武雄温泉駅での対面乗換（武雄市）', 'https://www.city.takeo.lg.jp/topics/shinkansen/convenient/3.html']]],
      ['かもめ', '「かもめ」の名は、60年以上前から', '特急「かもめ」が初めて長崎まで走ったのは1961年。在来線の特急として長く親しまれた名前が、2022年の開業で新幹線に受け継がれました。', [['懐かしの特急 かもめ（JR西日本）', 'https://www.westjr.co.jp/company/info/issue/bsignal/10_vol_131/express/index.html'], ['西九州新幹線の開業日について（JR九州）', 'https://www.jrkyushu.co.jp/news/__icsFiles/afieldfile/2022/02/22/220222_nishikyushu_kaigyoubi.pdf']]],
      ['武雄温泉', '楼門の設計は、東京駅と同じ人', '武雄温泉の入口に立つ朱塗りの楼門は1915年の完成で、設計は東京駅を手がけた辰野金吾です。釘を使わない造りで、国の重要文化財に指定されています。', [['武雄温泉楼門（武雄市観光協会）', 'https://www.takeo-kk.net/sightseeing/001373.php']]],
      ['大村', '新大村の近くに、世界初の海上空港', '長崎空港は、大村湾の海岸から約2kmに浮かぶ箕島を造成して、1975年に開港しました。世界初の本格的な海上空港として知られています。', [['空港概要（長崎空港）', 'https://nagasaki-airport.jp/outline/'], ['長崎空港（国土交通省 九州地方整備局）', 'https://www.pa.qsr.mlit.go.jp/nagasaki//port/airport/']]],
      ['大村', '日本で最初のキリシタン大名の町', '大村純忠は1563年に洗礼を受け、日本で最初のキリシタン大名になりました。のちの天正遣欧少年使節の派遣にもかかわった人物です。', [['キリシタン大名大村純忠（大村市）', 'https://www.city.omura.nagasaki.jp/kankou/kanko/kankouspot/kirishitan/oomurasumitada.html']]],
      ['嬉野温泉', '途中の嬉野温泉は「日本三大美肌の湯」', 'かもめが止まる嬉野温泉の町は、肌がなめらかになる湯で知られ、「日本三大美肌の湯」のひとつに数えられます。嬉野茶の産地としても有名です。', [['美肌の湯と呼ばれるその理由は？（嬉野温泉観光協会）', 'https://spa-u.net/post-1.php']]],
      ['博多駅', '博多駅の屋上には、神社がある', '2011年に完成した駅ビル「JR博多シティ」の屋上庭園「つばめの杜ひろば」には、旅の安全を祈る「鉄道神社」があります。展望スペースからは、駅に出入りする列車を見下ろせます。', [['つばめの杜ひろば（JR博多シティ）', 'https://www.jrhakatacity.com/floor/floorguide/?area=area1&floor=rf']]]
    ],
    osaka: [
      ['大阪城', 'いまの天守は、市民の寄付で建った', '大阪城のいまの天守閣は、1931年に市民の寄付金によって復興されました。1997年には国の登録有形文化財になり、博物館として公開されています。', [['大阪城天守閣（公式）', 'https://www.osakacastle.net/']]],
      ['地下鉄', '大阪の地下鉄は、御堂筋線から始まった', '1933年5月20日、御堂筋線の梅田〜心斎橋の開業が、大阪の地下鉄の始まりでした。今回の旅でも、新大阪・梅田・なんば・淀屋橋と、いちばんよく乗る路線です。', [['会社概要（Osaka Metro）', 'https://www.osakametro.co.jp/company/company_profile/kaisya_gaiyou.php']]],
      ['環状線', '阪神高速の環状線は、時計回りの一方通行', '大阪の都心をぐるりと囲む阪神高速1号環状線は、時計回りの一方通行です。1周はおよそ10km。10/18の夕方に、この環状線を一周します。', [['環状線走行（阪神高速道路）', 'https://www.hanshin-exp.co.jp/drivers/driver/tatsujin/aspect/loop_line/']]],
      ['中之島', '日本銀行大阪支店も、東京駅と同じ設計者', '中之島に立つ旧館は1903年の完成で、設計は辰野金吾。ベルギー国立銀行などを手本にした、緑青色の円屋根が目印の石造りの建物です。', [['旧館外観（日本銀行大阪支店）', 'https://www3.boj.or.jp/osaka/guide/guide01.html']]],
      ['淀屋橋', '「淀屋橋」は、豪商の名前', '江戸時代の豪商・淀屋が、店先の米市へ通う人の便利のために架けた橋が、名前の由来です。この米市はのちに堂島へ移り、堂島米市場になりました。', [['淀屋橋（大阪市北区）', 'https://www.city.osaka.lg.jp/kita/page/0000000943.html']]]
    ],
    line: [
      ['福山', '福山城の天守は、北側だけ鉄張り', '1622年に水野勝成が築いた福山城は、天守の北側の壁に防御の鉄板を張っていた、全国でも唯一とされる城です。築城400年の2022年に、この鉄板張りが復元されました。', [['福山城（福山市）', 'https://www.city.fukuyama.hiroshima.jp/site/miryoku2023/287233.html']]],
      ['三原', '三原駅は、お城の本丸の上', '三原駅は、小早川隆景が築いた三原城の本丸跡に建っています。満潮のときに海に浮かんで見えたことから「浮城」とも呼ばれました。', [['城下町三原で城跡＆寺社めぐり（三原市観光サイト）', 'https://www.city.mihara.hiroshima.jp/kankou/mihara.html']]],
      ['姫路', '姫路城は、日本で最初の世界遺産のひとつ', '1993年12月、法隆寺地域の仏教建造物とともに、日本で初めて世界文化遺産に登録されました。天守は国宝で、白く優美な姿から「白鷺城」とも呼ばれます。', [['世界文化遺産・国宝姫路城（姫路市）', 'https://www.city.himeji.lg.jp/castle/0000007744.html']]],
      ['岡山', '岡山後楽園は、日本三名園のひとつ', '岡山藩主の池田綱政が造らせ、1700年にひとまず完成した大名庭園です。水戸の偕楽園、金沢の兼六園とともに日本三名園に数えられ、国の特別名勝に指定されています。', [['歴史・概要（岡山後楽園）', 'https://okayama-korakuen.jp/rekishi/index.html']]],
      ['明石', '明石は、日本の時刻の基準の町', '日本の標準時は、明石市を通る東経135度の子午線で決められています。明石市立天文科学館は、この子午線の真上に建っています。', [['東経135度と日本標準時（明石市立天文科学館）', 'https://www.am12.jp/135-jstm/']]],
      ['山陽新幹線', '山陽新幹線は、2回に分けて開業した', '新大阪〜岡山は1972年、岡山〜博多は1975年3月10日に開業しました。2025年には、全線開業から50年を迎えています。', [['山陽新幹線 岡山開業50周年（JRおでかけネット）', 'https://www.jr-odekake.net/railroad/sanyo_shinkansen_okayama_50th/'], ['山陽新幹線全線開業50周年（JRおでかけネット）', 'https://www.jr-odekake.net/navi/sanyo_shinkansen_zensen_50th/']]],
      ['新関門トンネル', 'いちばん長いのは、海の下のトンネル', '小倉〜新下関で関門海峡の下を通る新関門トンネルは、長さ18,713mで、山陽新幹線でいちばん長いトンネルです。2番目は新神戸の東の六甲トンネル（16,250m）です。', [['トンネルベストテン（日本トンネル技術協会）', 'https://www.japan-tunnel.org/Gallery_best10']]],
      ['広島', '原爆ドームは、1996年に世界遺産に', 'もとは1915年に建てられた「広島県産業奨励館」です。核兵器の惨禍を伝える平和記念碑として、1996年12月に世界遺産に登録されました。', [['原爆ドームはいつ世界遺産に認定されたんですか（広島市）', 'https://www.city.hiroshima.lg.jp/faq/atomicbomb-peace/1001616/1002398.html']]],
      ['岩国', '錦帯橋は、5つのアーチの木の橋', '1673年に岩国藩主の吉川広嘉が架けた、5連の木造のアーチ橋です。1950年の台風で流されましたが、市民の強い声を受けて、木造のまま再建されました。', [['錦帯橋の概要（岩国市）', 'https://kintaikyo.iwakuni-city.net/summary.html']]]
    ]
  },

  /* 日の出・日の入り：国立天文台 暦計算室「日の出入り」の10/18の値（2026-10-02に確認。大阪は緯度34.6833°・経度135.4833°、奈良は34.6833°・135.8333°）。
     tips の「環状線は、ちょうど日の入りのころ」（10/18の日の入り：大阪17:20・奈良17:19）と同じ値 */
  sun: {
    date: '10/18',
    rows: [
      { name: '大阪市', rise: '6:06', set: '17:20', url: 'https://eco.mtk.nao.ac.jp/koyomi/dni/2026/s2810.html' },
      { name: '奈良市', rise: '6:04', set: '17:19', url: 'https://eco.mtk.nao.ac.jp/koyomi/dni/2026/s3010.html' }
    ]
  },

  /* ---------------- 旅のワンポイント（#/tips） ----------------
     行程に出てくるものだけ。事実を書くものは公式の出典を付ける（src）。しおりの行程そのものから言えることは、しおりの中のページへ（go） */
  tips: {
    /* 例年の気温：気象庁の平年値（旬ごと）のうち、旅行の日程（10/17〜10/20）にあたる10月中旬の日最高・日最低気温（2026-09-29に気象庁のページで確認）。
       大阪・奈良・福岡は1991〜2020年の平年値、大村はアメダス（1996〜2020年）の値 */
    tempsWhen: '10月中旬（11日〜20日）',
    temps: [
      { name: '大阪', when: '10/17〜10/20・泊まりと市内観光', hi: 23.9, lo: 16.2, url: 'https://www.data.jma.go.jp/stats/etrn/view/nml_sfc_10d.php?prec_no=62&block_no=47772' },
      { name: '奈良', when: '10/18の午後・奈良公園', hi: 22.8, lo: 13.6, url: 'https://www.data.jma.go.jp/stats/etrn/view/nml_sfc_10d.php?prec_no=64&block_no=47780' },
      { name: '福岡（博多）', when: '10/17・10/20の乗り換え', hi: 24.0, lo: 16.1, url: 'https://www.data.jma.go.jp/stats/etrn/view/nml_sfc_10d.php?prec_no=82&block_no=47807' },
      { name: '大村（出発・帰着）', when: '10/17の朝・10/20の午後', hi: 24.7, lo: 15.6, url: 'https://www.data.jma.go.jp/stats/etrn/view/nml_amd_10d.php?prec_no=84&block_no=1084' }
    ],
    forecast: [['大阪府の天気予報（気象庁）', 'https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code=270000'], ['奈良県の天気予報（気象庁）', 'https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code=290000']],
    wear: [
      ['日中', '例年の最高気温は23〜25℃ほど。長袖のシャツやカットソーに、薄手の羽織りものを1枚。歩いて暑くなったら脱げるように。'],
      ['朝晩', '例年の最低気温は14〜16℃ほどで、奈良は大阪より2〜3℃低めです。10/18は7:49にホテルを出て、帰りは日の入りのあと。カーディガンや薄手の上着があると安心です。'],
      ['新幹線・車の中', '冷房が効いていることがあります。約2時間半の新幹線では、膝掛けがわりになる上着が便利です。'],
      ['足もと', '奈良公園は往復約5km、砂利や石畳もあります。履き慣れたスニーカーで。'],
      ['雨の日', '折りたたみ傘を。大仏殿の中は屋内ですが、駐車場からは屋外を歩きます。']
    ],
    items: [
      { id: 'bag160', day: [1, 4], title: '大きな荷物は「3辺で160cm」が目安', text: '3辺の合計が160cmを超えるスーツケースを新幹線に持ち込むときは、「特大荷物スペースつき座席」の予約が必要です。予約なしで持ち込むと、車内で手数料がかかります（250cmを超えるものは持ち込めません）。',
        src: [['新幹線への「特大荷物」の持ち込みについて（JRおでかけネット）', 'https://www.jr-odekake.net/railroad/service/baggage/']] },
      { id: 'hakata', day: [1], title: '博多の乗り換えは33分。駅弁はこの間に', text: 'リレーかもめ92号の博多着は11:42、のぞみ28号の発車は12:15。駅弁は、2階の新幹線改札内のコンコースで買うのがいちばん早く済みます。',
        go: [['博多駅の駅弁', '#/ride/ekiben'], ['博多の乗り換え（3D）', 'transfer.html#s1']] },
      { id: 'checkin', day: [1], title: 'ホテルに着くのは、チェックインの始まるころ', text: 'のぞみ28号の新大阪着は14:43、ホテルまでは歩いて約10分です。チェックインは15:00からなので、急がずに向かえば、ちょうど受付の始まるころに着きます。',
        go: [['ホテルとお部屋', '#/stay'], ['新大阪での出方（3D）', 'transfer.html#s2']] },
      { id: 'shoes', day: [2], title: '奈良公園は、歩きやすい靴で', text: '駐車場から大仏殿までの往復で、約5km歩く予定です。砂利や石畳もあるので、履き慣れたスニーカーが安心です。子どもが疲れたときのために、抱っこひもがあると切り替えられます。',
        go: [['東大寺・奈良公園', '#/spot/todaiji']] },
      { id: 'deer', day: [2], title: '鹿にあげてよいのは、鹿せんべいだけ', text: '鹿せんべい以外の食べ物は与えないでください。せんべいは1枚ずつ素早くあげ、なくなったら両手を開いて見せます。鹿は野生動物で、かむ・突く・突進することもあるので、むやみに触らないようにしましょう。',
        src: [['鹿による人身事故啓発（奈良の鹿愛護会）', 'https://naradeer.com/learning/keihatsu.html'], ['鹿との接し方（奈良市観光協会）', 'https://narashikanko.or.jp/feature/deer']] },
      { id: 'daibutsu', day: [2], title: '10月の大仏殿は17:30まで', text: '10月の大仏殿は7:30〜17:30です。行程の滞在（14:10〜16:10）なら時間に余裕があります。法華堂・戒壇堂は16:00までなので、寄るなら先に回りましょう。',
        src: [['東大寺（奈良市観光協会）', 'https://narashikanko.or.jp/spot/detail_10001.html']], go: [['拝観料と時間', '#/spot/todaiji']] },
      { id: 'sunset', day: [2], title: '環状線は、ちょうど日の入りのころ', text: '10/18の日の入りは、大阪で17時20分（奈良は17時19分）。環状線を回る17:06〜17:25は、夕暮れの街を眺める時間になります。景色は同乗者の楽しみにして、運転する人は運転に集中を。',
        src: [['日の出入り＠大阪 2026年10月（国立天文台 暦計算室）', 'https://eco.mtk.nao.ac.jp/koyomi/dni/2026/s2810.html'], ['日の出入り＠奈良 2026年10月（国立天文台 暦計算室）', 'https://eco.mtk.nao.ac.jp/koyomi/dni/2026/s3010.html']], go: [['環状線ドライブ', '#/spot/loop']] },
      { id: 'ecocard', day: [3], title: '10/19の地下鉄は、1日乗車券がお得', text: 'この日の地下鉄の運賃は、行程のとおりに乗ると大人1人で合計1,010円です。平日の1日乗車券「エンジョイエコカード」は大人820円（小児310円）なので、こちらがお得です。',
        src: [['1日乗車券「エンジョイエコカード」（Osaka Metro）', 'https://subway.osakametro.co.jp/guide/page/enjoy-eco.php']], go: [['3日目の行程', '#/trip/3']] },
      { id: 'ic', day: [1, 3], title: '九州の交通系ICカードも、そのまま使えます', text: 'SUGOCAなど九州のICカードは、全国相互利用のしくみで、Osaka Metro と JR の大阪の電車でもそのまま使えます。',
        src: [['ICOCA、Suica、PASMOなどは、地下鉄・バスで使えますか？（Osaka Metro）', 'https://om-faq-zd.osakametro.co.jp/hc/ja/articles/32385370360217'], ['ICOCAのご利用可能エリア（JRおでかけネット）', 'https://www.jr-odekake.net/icoca/area/']] },
      { id: 'wowus', day: [3], title: 'WowUsは、出かける前に営業を確かめて', text: '16階の展望テラスは入場無料ですが、不定休で、貸切や臨時休業の日があります。ホテルを出る前に、公式サイトで確かめておくと安心です。',
        src: [['大阪堂島浜タワー WowUs（公式）', 'https://www.wow-us.jp/']], go: [['WowUs', '#/spot/wowus']] },
      { id: 'checkout', day: [4], title: 'お弁当とおみやげは、新大阪で', text: 'チェックアウトは11:00まで、ホテルを出るのは10:20の予定です。新大阪ではのぞみ17号の発車まで約30分あるので、車内で食べるお弁当やおみやげはここで。',
        go: [['4日目の行程', '#/trip/4'], ['新大阪での乗り方（3D）', 'transfer.html#s3']] }
    ]
  },

  /* 持ち物（しおりの内容から必要になるものを中心に） */
  bag: [
    { cat: '必ず持つもの', items: [
      ['運転免許証（運転する人全員）', 'レンタカーで全員分の提示が必要'],
      ['クレジットカード', 'ミニバンクラスはカード決済が必須'],
      ['現金', '「きじ」「はなだこ」は現金のみ'],
      ['交通系ICカード', '地下鉄・JRの乗り継ぎに'],
      ['スマホと充電器・モバイルバッテリー', 'このしおりもスマホで見ます'],
      ['マイナ保険証 または 資格確認書', 'もしものときの受診に'],
      ['お薬手帳・常備薬', ''],
      ['母子健康手帳', '子どもの受診に（あれば）']
    ] },
    { cat: '服・身のまわり', items: [
      ['着替え（3泊分）', ''],
      ['朝晩に羽織る上着', '10月の奈良・大阪は朝晩ひんやり'],
      ['歩きやすい靴', '奈良公園は往復約5km、砂利や石畳も'],
      ['折りたたみ傘', ''],
      ['ハンカチ・ティッシュ・ウェットティッシュ', '鹿せんべいのあとにも']
    ] },
    { cat: 'あると便利', items: [
      ['エコバッグ', 'おみやげや駅弁に'],
      ['抱っこひも', '砂利道や石畳では抱っこに切り替え'],
      ['子どものおやつ・飲みもの', '新幹線は約2時間半'],
      ['HDMIケーブル', '客室のテレビにつなげます']
    ] }
  ]
};
