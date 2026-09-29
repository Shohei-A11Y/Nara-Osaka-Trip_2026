/* 大阪市内の駅の時刻表：駅・路線・旅程とのつながり
   時刻そのものは timetable-data.js（公式時刻表から転記）にある */
window.TT = {
  lines: {
    midosuji: { name: '御堂筋線', co: 'Osaka Metro', color: 'var(--midosuji)', info: 'https://subway.osakametro.co.jp/guide/subway_information.php' },
    sennichimae: { name: '千日前線', co: 'Osaka Metro', color: 'var(--sennichimae)', info: 'https://subway.osakametro.co.jp/guide/subway_information.php' },
    tanimachi: { name: '谷町線', co: 'Osaka Metro', color: 'var(--tanimachi)', info: 'https://subway.osakametro.co.jp/guide/subway_information.php' },
    loop: { name: '大阪環状線', co: 'JR西日本', color: 'var(--loop)', info: 'https://trafficinfo.westjr.co.jp/kinki.html' },
    kyoto: { name: 'JR京都線', co: 'JR西日本', color: 'var(--kyoto)', info: 'https://trafficinfo.westjr.co.jp/kinki.html' }
  },
  /* 旅程の順。dirs は timetable-data.js の表の id */
  stations: [
    { id: 'shinosaka', name: '新大阪', roma: 'Shin-Ōsaka', code: 'M13', lines: [{ line: 'midosuji', dirs: ['shinosaka-midosuji-S', 'shinosaka-midosuji-N'] }] },
    { id: 'umeda', name: '梅田', roma: 'Umeda', code: 'M16', lines: [{ line: 'midosuji', dirs: ['umeda-midosuji-N', 'umeda-midosuji-S'] }] },
    { id: 'namba', name: 'なんば', roma: 'Namba', code: 'S16', lines: [{ line: 'sennichimae', dirs: ['namba-sennichimae-E'] }] },
    { id: 'tanimachi9', name: '谷町九丁目', roma: 'Tanimachi 9-chōme', code: 'T25', lines: [{ line: 'tanimachi', dirs: ['tanimachi9-tanimachi-N'] }] },
    { id: 'osakajokoen', name: '大阪城公園', roma: 'Ōsakajōkōen', code: 'JR-O05', official: 'https://www.jr-odekake.net/eki/timetable?id=0610515', lines: [{ line: 'loop', dirs: ['osakajokoen-loop-kyobashi'] }] },
    { id: 'osaka', name: '大阪', roma: 'Ōsaka', code: 'JR-A47', official: 'https://www.jr-odekake.net/eki/timetable?id=0610130', lines: [{ line: 'kyoto', dirs: ['osaka-kyoto-N'] }] },
    { id: 'yodoyabashi', name: '淀屋橋', roma: 'Yodoyabashi', code: 'M17', lines: [{ line: 'midosuji', dirs: ['yodoyabashi-midosuji-N'] }] }
  ],
  /* 旅程で乗る区間。date + from + dep で旅程の駅とつなぐ */
  legs: [
    { id: 'd1-shinosaka', date: '2026-10-17', from: '新大阪', dep: '16:13', station: 'shinosaka', table: 'shinosaka-midosuji-S', to: '梅田', min: 6, platform: '1番ホーム', car: '3両目', exit: '8番口', near: '大阪ステーションシティ', fare: '240円' },
    { id: 'd1-umeda', date: '2026-10-17', from: '梅田', dep: '17:42', station: 'umeda', table: 'umeda-midosuji-N', to: '新大阪', min: 6, platform: '2番ホーム', car: '1・3両目', exit: '4番口', near: 'ホテル', fare: '240円' },
    { id: 'd3-shinosaka-am', date: '2026-10-19', from: '新大阪', dep: '9:12', station: 'shinosaka', table: 'shinosaka-midosuji-S', to: 'なんば', min: 16, platform: '1番ホーム', car: '7・9両目', exit: '14番口', near: '道頓堀', fare: '290円（1日乗車券なら不要）' },
    { id: 'd3-namba', date: '2026-10-19', from: 'なんば', dep: '10:25', station: 'namba', table: 'namba-sennichimae-E', to: '谷町九丁目', min: 3, platform: '1番ホーム', car: '4両目', exit: '谷町線へ乗り換え', near: '', fare: '谷町四丁目まで240円（1日乗車券なら不要）' },
    { id: 'd3-tanimachi9', date: '2026-10-19', from: '谷町九丁目', dep: '10:34', station: 'tanimachi9', table: 'tanimachi9-tanimachi-N', to: '谷町四丁目', min: 3, platform: '2番ホーム', car: '1両目', exit: '1-B口', near: '大阪城公園', fare: 'なんばからの通し（240円）' },
    { id: 'd3-osakajokoen', date: '2026-10-19', from: '大阪城公園', dep: '13:02', station: 'osakajokoen', table: 'osakajokoen-loop-kyobashi', to: '大阪', min: 9, platform: '1番ホーム', car: '前のほうの車両', note: 'Q大和路快速は、いちばん後ろの車両の一部が指定席「うれしート」です（指定席券が必要）。前のほうの車両なら、そのまま乗れます。', exit: 'JR京都線へ乗り換え（6分）', near: '', fare: '新大阪まで200円（ICカード可）' },
    { id: 'd3-osaka', date: '2026-10-19', from: '大阪', dep: '13:17', station: 'osaka', table: 'osaka-kyoto-N', to: '新大阪', min: 3, platform: '7番ホーム', car: '中ほどの車両', exit: '6番口', near: 'ホテル', fare: '大阪城公園からの通し（200円）' },
    { id: 'd3-shinosaka-pm', date: '2026-10-19', from: '新大阪', dep: '15:41', station: 'shinosaka', table: 'shinosaka-midosuji-S', to: '淀屋橋', min: 10, platform: '1番ホーム', car: '10両目', exit: '7番口', near: 'WowUs', fare: '240円（1日乗車券なら不要）' },
    { id: 'd3-yodoyabashi', date: '2026-10-19', from: '淀屋橋', dep: '17:03', station: 'yodoyabashi', table: 'yodoyabashi-midosuji-N', to: '新大阪', min: 9, platform: '2番ホーム', car: '1・3両目', exit: '4番口', near: 'ホテル', fare: '240円（1日乗車券なら不要）' }
  ],
  /* 表の方面名（timetable-data.js に dir が無いときの予備） */
  dirNames: { 'osakajokoen-loop-kyobashi': '京橋・大阪方面', 'osaka-kyoto-N': '新大阪・京都方面' },
  /* 土休日ダイヤになる祝日（旅行の前後だけ） */
  holidays: ['2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23']
};
