/* 新幹線クイズ（game/quiz.json）の点検。使い方：node tools/check-quiz.js
   - 各問：正解が1つ（4択・穴埋め・地図当ては選択肢4つが重ならず、正解の番号が範囲内。並べ替え・組み合わせは項目が重ならず、正しい並び・組が1通り）
   - 出典が2つ以上（名前とURL。同じURLの重複なし）、解説がある
   - 地図当て：線路・印の駅・選択肢の駅が、同梱の駅データにある。印の駅が正解の選択肢
   - 章ごとの問題の形の数と、読み・車窓の問題の数を表にして出す
   問題があれば一覧を出して終了コード1 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'game', 'quiz.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const errs = [];
const err = (id, m) => errs.push(`${id}: ${m}`);
const TYPES = { choice: '4択', fill: '穴埋め', order: '並べ替え', match: '組み合わせ', map: '地図当て' };
const uniq = a => new Set(a).size === a.length;
const ids = new Set();
const total = Object.fromEntries(Object.keys(TYPES).map(k => [k, 0]));
const rows = [];

if (!Array.isArray(data.chapters) || !data.chapters.length) err('quiz', '章がない');
for (const ch of data.chapters || []) {
  if (!ch.id || !ch.name) err(ch.id || '?', '章の id・name がない');
  if (ids.has(ch.id)) err(ch.id, '章の id が重なっている');
  ids.add(ch.id);
  const count = Object.fromEntries(Object.keys(TYPES).map(k => [k, 0]));
  const tags = {};
  if ((ch.qs || []).length !== 10) err(ch.id, `問題が${(ch.qs || []).length}問（10問のはず）`);
  for (const q of ch.qs || []) {
    const id = q.id || `${ch.id}-?`;
    if (ids.has(id)) err(id, '問題の id が重なっている');
    ids.add(id);
    if (!TYPES[q.type]) { err(id, `問題の形「${q.type}」が不明`); continue; }
    count[q.type]++; total[q.type]++;
    if (q.tag) tags[q.tag] = (tags[q.tag] || 0) + 1;
    if (!q.q || !q.q.trim()) err(id, '問題文がない');
    if (!q.ex || !q.ex.trim()) err(id, '解説がない');
    if (!Array.isArray(q.src) || q.src.length < 2) err(id, `出典が${(q.src || []).length}つ（2つ以上のはず）`);
    else {
      q.src.forEach((s, i) => { if (!Array.isArray(s) || !s[0] || !/^https?:\/\//.test(s[1] || '')) err(id, `出典${i + 1}の名前かURLがおかしい`); });
      if (!uniq(q.src.map(s => s[1]))) err(id, '出典のURLが重なっている');
    }
    if (q.type === 'choice' || q.type === 'fill' || q.type === 'map') {
      if (!Array.isArray(q.opts) || q.opts.length !== 4) err(id, '選択肢が4つでない');
      else if (!uniq(q.opts)) err(id, '選択肢が重なっている（正解が1つに決まらない）');
      if (!Number.isInteger(q.a) || q.a < 0 || q.a >= (q.opts || []).length) err(id, '正解の番号が範囲外');
      if (q.type === 'fill' && !q.q.includes('＿＿')) err(id, '穴埋めの「＿＿」がない');
    }
    if (q.type === 'map') {
      const m = (data.maps || {})[q.line];
      if (!m) { err(id, `線路「${q.line}」が maps にない`); continue; }
      const st = m.st || {};
      if (!st[q.mark]) err(id, `印の駅「${q.mark}」が駅データにない`);
      if (q.opts && q.opts[q.a] !== q.mark) err(id, '印の駅と正解の選択肢が違う');
      (q.opts || []).forEach(o => { if (!st[o]) err(id, `選択肢の駅「${o}」が駅データにない`); });
      [...(q.labels || []), ...(q.view || [])].forEach(o => { if (!st[o]) err(id, `表示する駅「${o}」が駅データにない`); });
      if ((q.labels || []).includes(q.mark)) err(id, '印の駅の名前が地図に出てしまう');
      if (!fs.existsSync(path.join(__dirname, '..', 'game', m.url.split('?')[0]))) err(id, `線路のファイル ${m.url} がない`);
    }
    if (q.type === 'order') {
      if (!Array.isArray(q.items) || q.items.length < 3) err(id, '並べる項目が3つ未満');
      else if (!uniq(q.items)) err(id, '並べる項目が重なっている（正しい並びが1通りに決まらない）');
    }
    if (q.type === 'match') {
      if (!Array.isArray(q.pairs) || q.pairs.length < 3 || q.pairs.length > 4) err(id, '組が3〜4組でない');
      else {
        if (!uniq(q.pairs.map(p => p[0]))) err(id, '左側が重なっている');
        if (!uniq(q.pairs.map(p => p[1]))) err(id, '右側が重なっている（正しい組が1通りに決まらない）');
      }
    }
  }
  const kinds = Object.values(count).filter(n => n).length;
  if (kinds < 2) err(ch.id, '問題の形が2種類未満');
  rows.push([`${ch.no}. ${ch.name}`, ...Object.keys(TYPES).map(k => count[k]), tags['読み'] || 0, tags['車窓'] || 0]);
}

const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - [...String(s)].reduce((w, c) => w + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
console.log(pad('章', 28) + Object.values(TYPES).map(t => pad(t, 11)).join('') + pad('読み', 6) + '車窓');
rows.forEach(r => console.log(pad(r[0], 28) + r.slice(1, 6).map(n => pad(n, 11)).join('') + pad(r[6], 6) + r[7]));
console.log(pad('合計', 28) + Object.keys(TYPES).map(k => pad(total[k], 11)).join('') + `（全${Object.values(total).reduce((a, b) => a + b, 0)}問）`);
if (errs.length) { console.log(`\n問題が${errs.length}件：`); errs.forEach(e => console.log('  ' + e)); process.exit(1); }
console.log('\nすべての問題：正解1つ・出典2つ以上・解説あり（OK）');
