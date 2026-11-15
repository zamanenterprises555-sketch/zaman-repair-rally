// NODE_PATH=/workspace/zcq-test/node_modules node tests/solo.e2e.js   (BASE = local server or the live site)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8766/';
const SH = process.env.SH || __dirname + '/../shots/'; const BOTS = +(process.env.BOTS || 10);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PWX, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await c.addInitScript(() => { localStorage.setItem('zrr_voice', 'false'); });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|fonts/.test(m.text())) errs.push(m.text()); });
  const st = () => p.evaluate(() => { const r = ZRR.S.room; if (!r) return null; const g = r.g || {}; const me = ZRR.S.me; return { status: r.status, phase: g.phase, r: g.r, seq: g.seq, car: g.cars && g.cars[me], res: g.res && g.res[me], n: g.order && g.order.length, startAt: g.startAt, qAt: g.qAt, now: Date.now(), sfx: ZRR.lastSfx || '', boardHidden: document.querySelector('#board') ? document.querySelector('#board').hidden : null }; });
  const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await st().catch(() => null); if (s && fn(s)) return s; await p.waitForTimeout(100); } return st(); };
  const correct = () => p.evaluate(() => ZRR.E.questionFor(ZRR.S.room, ZRR.S.me, questionSets).q.a);
  const shot = async name => { await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + name }); };
  const answerWhenOpen = async i => { await p.waitForSelector('[data-act=ans]', { timeout: 10000 }); const t = Date.now(); await p.click(`[data-act=ans][data-i="${i}"]`); return t; };
  await p.goto(BASE); await p.waitForTimeout(600);
  await shot('v2-01-home.png');
  ok(!(await p.$('script[src*="three"]')) && !(await p.evaluate(() => !!window.THREE)), 'no Three.js / 3D loaded');
  await p.fill('#nameIn', 'അൻവർ'); await p.selectOption('#soloBots', String(BOTS)); await p.click('[data-act=solo]');
  let s = await until(s => s.phase === 'count', 5000); ok(s.phase === 'count' && s.n === BOTS + 1, 'solo race with ' + (BOTS + 1) + ' cars');
  ok(!s.boardHidden && (await p.$$('.lane')).length === BOTS + 1, 'race bar: one lane per racer (' + (await p.$$('.lane')).length + ')');
  await shot('v2-02-start-racebar.png');
  s = await until(s => s.phase === 'q', 6000); ok(s.phase === 'q' && s.startAt - s.qAt === 3000, 'question shown with 3 s reading time');
  ok(s.boardHidden === true, 'race bar + leaderboard hidden while the question is on screen');
  await p.waitForTimeout(300);
  const rtxt = await p.textContent('.readbox').catch(() => ''); ok(/വായിക്കൂ/.test(rtxt), 'calm reading countdown: ' + rtxt.trim());
  ok((await p.$$('[data-act=ans]')).length === 0 && (await p.$$eval('.opt', x => x.length > 0 && x.every(o => o.disabled))), 'answers disabled during reading time');
  const sfxBefore = (await st()).sfx;
  await shot('v2-03-question-reading.png');
  // wrong answer -> breakdown, sputter, speedometer at 0
  let a = await correct(); const tOpen = await answerWhenOpen((a + 1) % 4);
  s = await st(); ok(tOpen >= s.startAt - 150, 'answer opened only after reading period');
  s = await until(s => s.phase === 'rev'); ok(s.res.k === 'wrong' && s.car.pit === 1, 'wrong answer = breakdown → pit');
  await p.waitForTimeout(200); s = await st(); ok(s.sfx === 'sputter', 'breakdown plays sputter "tuk tuk"');
  const kmh0 = (await p.textContent('.speedo .kmh')).trim(); ok(/^0 /.test(kmh0), 'speedometer 0 for wrong: ' + kmh0);
  await shot('v2-04-result-breakdown-speedo.png');
  s = await until(s => s.phase === 'q' && s.r === 1); ok(!!(await p.$('.tagline.pit')) && s.startAt - s.qAt === 3000, 'pit-stop repair question also gets reading time');
  a = await correct(); await answerWhenOpen(a);
  s = await until(s => s.phase === 'rev' && s.r === 1); ok(s.res.k === 'fix' && s.car.pit === 0, 'repair correct → back in race');
  let rounds = 0, lastSeq = -1, gotHigh = false, gotNitro = false, gotArrow = false;
  while (true) {
    s = await until(s => s.status !== 'racing' || (s.phase === 'q' && s.seq !== lastSeq), 20000);
    if (s.status !== 'racing') break;
    lastSeq = s.seq;
    if (s.car && !s.car.fin) { a = await correct(); await answerWhenOpen(a).catch(() => {}); }
    s = await until(s => s.status !== 'racing' || s.phase === 'rev', 20000); rounds++;
    if (s.status !== 'racing') break;
    if (s.res && s.res.k === 'ok' && !s.res.n && !gotHigh) {
      gotHigh = true; await p.waitForTimeout(350); const k = (await p.textContent('.speedo .kmh')).trim(); s = await st();
      ok(parseInt(k) >= 100 && s.sfx === 'vroom', 'fast correct: speedometer ' + k + ', engine vroom');
      await shot('v2-05-result-speedometer.png');
    }
    if (s.res && s.res.n && !gotNitro) { gotNitro = true; await p.waitForTimeout(500); s = await st(); ok(s.sfx === 'whoosh', 'nitro whoosh'); await shot('v2-06-nitro-result.png'); }
    if (!gotArrow && rounds >= 3) { const arr = await p.$$eval('.lr b.up, .lr b.dn', x => x.length); if (arr > 0) { gotArrow = true; ok(true, 'leaderboard ▲/▼ change after checkpoint (' + arr + ')'); await p.waitForTimeout(400); await shot('v2-07-racebar-leaderboard.png'); } }
  }
  ok(gotNitro && gotArrow, 'nitro and leaderboard arrows seen');
  s = await until(s => s.status === 'finished', 30000); ok(s.status === 'finished', 'race finished after ' + (rounds + 2) + ' rounds');
  await p.waitForTimeout(500); await shot('v2-08-podium.png'); await p.screenshot({ path: SH + 'v2-09-result-full.png', fullPage: true });
  const txt = await p.textContent('#result'); ok(txt.includes('തെറ്റിയ ചോദ്യങ്ങൾ') && txt.includes('ശരിയുത്തരം'), 'review of wrong answers');
  ok(!!(await p.$('a.academy[href*="zaman-smartphone-repair-academy"]')), 'academy button');
  const rank = await p.evaluate(() => ZRR.S.room.g.rank.indexOf(ZRR.S.me) + 1); ok(rank === 1, 'perfect player (1 breakdown) position ' + rank);
  const log = await p.evaluate(() => ZRR.sfxLog || []); ok(log.length > 10 && log.every(x => /@rev$/.test(x)), 'engine sounds only at the result moment (' + log.length + ' sounds, all in result phase)');
  await p.click('#topRight [data-act=sound]'); ok(await p.evaluate(() => localStorage.getItem('zrr_sound') === 'false'), 'sound toggle off is saved');
  await p.click('#topRight [data-act=sound]');
  const o1 = await p.evaluate(() => ZRR.S.room.g.qo.join()); await p.click('#result [data-act=solo]'); await until(s => s.phase === 'count', 5000);
  ok(o1 !== await p.evaluate(() => ZRR.S.room.g.qo.join()), 'rematch: new shuffled question order');
  const anim = await p.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } }).filter(r => r.type === 7 || /animation/.test(r.cssText)).length);
  ok(anim === 0, 'no CSS animations/keyframes in the app');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 5)));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
