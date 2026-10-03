#!/usr/bin/env node
/* 予算を data.js から assets/budget.json に移したとき（2026-10-03）の、表示の比べ合わせ。
   使い方（リポジトリの一番上で）：node tools/check-budget.js
   移す前の data.js にあった手書きの数字（OLD）と、budget.json から assets/budget.js で計算した数字を、1つずつ並べて比べる。

   移す前の手書きの数字には、800円の食い違いが1つあった（PDFのしおりも同じ）：
     「3日目 JR大阪城公園→新大阪 大人4名@200＝800円」は明細では「乗車券・入場料」にあるのに、
     「交通費」の小計（177,440円＝明細の合計176,640円＋800円）と、家族ごとの内訳の「交通費」（各400円）にも数えていた。
     合計（432,040円）と家族ごとの合計（飯塚家252,790円・山口家179,250円）は、明細どおりの正しい額。
   自動計算は明細どおりに数えるので、この5か所だけは違って出る（KNOWN）。それ以外が1つでも違えば失敗にする。 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OLD = {"total":432040,"groups":[{"name":"交通費","note":"早得予約運賃","sum":177440,"rows":[["1日目 新大村→博多","早得7／大人4名@3,400・子ども2名@1,700",17000],["1日目 博多→新大阪","EX早得7／大人4名@13,600・子ども2名@6,800",68000],["4日目 新大阪→博多","EX早特7／大人2名@13,600",27200],["4日目 新大阪→博多","EX通常／大人2名@15,820・子ども2名@7,900",47440],["4日目 博多→新大村","早得7／大人4名@3,400・子ども2名@1,700",17000]]},{"name":"宿泊費","note":"確定予約の実額","sum":182000,"rows":[["飯塚家4名（大人2・子ども2）","朝食付・2部屋・3泊",107450],["山口家2名（大人2）","朝食付・1部屋・3泊",74550]]},{"name":"レンタカー関連","note":"","sum":21400,"rows":[["レンタカー","ミニバンクラス",15730],["ETC","高速・有料道路",2670],["ガソリン代","ノア想定",2000],["駐車代","奈良公園近くのコインパーキング",1000]]},{"name":"食費","note":"子ども2名分は含めず","sum":46000,"rows":[["1日目 朝食","新幹線車内／@1,000",4000],["2〜3日目 昼食","@1,500×2日",12000],["4日目 昼食","@1,500",6000],["1〜2日目 夕食","@2,000×2日",16000],["3日目 夕食","@2,000",8000]]},{"name":"乗車券・入場料","note":"子ども2名分は含めず","sum":6000,"rows":[["1日目 地下鉄","大人4名@480（子どもは無料）",1920],["3日目 地下鉄1日乗車券","大人4名@820",3280],["3日目 JR大阪城公園→新大阪","大人4名@200",800]]}],"families":[["交通費",109040,68400,"人数で按分。復路のぞみは除く（子ども2名は飯塚家分）"],["宿泊費",107450,74550,"確定予約の実額"],["レンタカー関連",10700,10700,"2家族で折半"],["食費",23000,23000,"2家族で折半"],["乗車券・入場料",2600,2600,"大人4名で按分・子どもは無料"]],"famTotal":{"iizuka":252790,"yamaguchi":179250}};
const KNOWN = ['交通費 小計', '家族別 交通費 飯塚家', '家族別 交通費 山口家', '家族別 乗車券・入場料 飯塚家', '家族別 乗車券・入場料 山口家'];

const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, fetch: () => Promise.reject(new Error('no')) };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/budget.js'), 'utf8'), ctx);
const R = ctx.window.Budget.compute(JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/budget.json'), 'utf8')));
const rows = [];
const cmp = (what, a, b) => rows.push({ same: a === b, what, a, b });
cmp('合計', OLD.total, R.total);
OLD.groups.forEach((g, i) => {
  const G = R.groups[i] || { rows: [], fam: {} };
  cmp(`分類${i + 1}の名前`, g.name, G.name); cmp(`${g.name} 小計`, g.sum, G.sum); cmp(`${g.name} 注記`, g.note, G.note);
  g.rows.forEach((r, j) => { const x = G.rows[j] || {}; cmp(`${g.name} ${j + 1} 項目名`, r[0], x.name); cmp(`${g.name} ${j + 1} 内訳`, r[1], x.text); cmp(`${g.name} ${j + 1} 金額`, r[2], x.amount); });
  cmp(`${g.name} 行の数`, g.rows.length, G.rows.length);
});
OLD.families.forEach(([k, a, b, n], i) => { const G = R.groups[i] || { fam: {} }; cmp(`家族別 ${k} 飯塚家`, a, G.fam.iizuka); cmp(`家族別 ${k} 山口家`, b, G.fam.yamaguchi); cmp(`家族別 ${k} 説明`, n, G.famNote); });
cmp('家族別 合計 飯塚家', OLD.famTotal.iizuka, R.fam.iizuka); cmp('家族別 合計 山口家', OLD.famTotal.yamaguchi, R.fam.yamaguchi);
cmp('分類の数', OLD.groups.length, R.groups.length);
const bad = rows.filter(r => !r.same && !KNOWN.includes(r.what)), known = rows.filter(r => !r.same && KNOWN.includes(r.what));
console.log(`比べた項目 ${rows.length}　同じ ${rows.filter(r => r.same).length}　800円の食い違いの分 ${known.length}　そのほかの違い ${bad.length}`);
known.forEach(r => console.log(`  （食い違いの分）${r.what}：移す前 ${r.a} → 自動計算 ${r.b}`));
bad.forEach(r => console.log(`  違う：${r.what}：移す前 ${JSON.stringify(r.a)} → 自動計算 ${JSON.stringify(r.b)}`));
if (process.argv.includes('-v')) rows.forEach(r => console.log(`${r.same ? '同じ' : '違う'}\t${r.what}\t${r.a}\t${r.b}`));
process.exit(bad.length ? 1 : 0);
