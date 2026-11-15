// NODE_PATH=/workspace/zcq-test/node_modules node tests/solo.e2e.js   (needs a local server on BASE)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8766/';
const SH = process.env.SH || __dirname + '/../shots/';
const MODE = process.env.MODE || '3d', BOTS = +(process.env.BOTS || 10), PFX = process.env.PFX || '';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PWX, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await c.addInitScript(m => { localStorage.setItem('zrr_mode', JSON.stringify(m)); localStorage.setItem('zrr_fpsask', '1'); localStorage.setItem('zrr_voice', 'false'); }, MODE);
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|fonts/.test(m.text())) errs.push(m.text()); });
  const st = () => p.evaluate(() => { const r = ZRR.S.room; if (!r) return null; const g = r.g || {}; const me = ZRR.S.me; return { status: r.status, phase: g.phase, r: g.r, seq: g.seq, car: g.cars && g.cars[me], res: g.res && g.res[me], n: g.order && g.order.length, mode: ZRR.S.viewMode, fps: ZRR.S.view && ZRR.S.view.fps(), info: ZRR.S.view && ZRR.S.view.info() }; });
  const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await st().catch(() => null); if (s && fn(s)) return s; await p.waitForTimeout(120); } return st(); };
  const correct = () => p.evaluate(() => { const r = ZRR.S.room; return ZRR.E.questionFor(r, ZRR.S.me, questionSets).q.a; });
  await p.goto(BASE); await p.waitForTimeout(800);
  if (!PFX) await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + '01-home.png' });
  await p.fill('#nameIn', 'അൻവർ'); await p.selectOption('#soloBots', String(BOTS)); await p.click('[data-act=solo]');
  let s = await until(s => s.phase === 'count', 5000); ok(s && s.phase === 'count' && s.n === BOTS + 1, 'solo race with ' + (BOTS + 1) + ' cars, countdown');
  await p.waitForTimeout(1500); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + PFX + '02-start-grid-' + MODE + '.png' });
  s = await until(s => s.phase === 'q', 6000); ok(s.phase === 'q' && s.r === 0, 'checkpoint 1 question live');
  ok(s.mode === MODE, 'view mode ' + s.mode);
  await p.waitForTimeout(1200); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + PFX + '03-question-' + MODE + '.png' });
  // 1) wrong answer -> breakdown + pit
  let a = await correct(); await p.click(`[data-act=ans][data-i="${(a + 1) % 4}"]`);
  s = await until(s => s.phase === 'rev'); ok(s.res && s.res.k === 'wrong' && s.car.pit === 1, 'wrong answer = breakdown, car to pit');
  await p.waitForTimeout(400); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + PFX + '04-breakdown-' + MODE + '.png' });
  s = await until(s => s.phase === 'q' && s.r === 1); ok(!!(await p.$('.tagline.pit')), 'pit-stop repair question shown');
  await p.waitForTimeout(1800); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + PFX + '05-pit-stop-' + MODE + '.png' });
  a = await correct(); await p.click(`[data-act=ans][data-i="${a}"]`);
  s = await until(s => s.phase === 'rev' && s.r === 1); ok(s.res.k === 'fix' && s.car.pit === 0, 'repair correct: back in the race');
  // 2) three fast correct answers -> nitro
  let nitroShot = false, rounds = 0, lastSeq = -1;
  while (true) {
    s = await until(s => s.status !== 'racing' || (s.phase === 'q' && s.seq !== lastSeq), 15000);
    if (s.status !== 'racing') break;
    lastSeq = s.seq;
    if (s.car && !s.car.fin) { a = await correct(); await p.click(`[data-act=ans][data-i="${a}"]`).catch(() => {}); }
    s = await until(s => s.status !== 'racing' || s.phase === 'rev', 15000); rounds++;
    if (s.res && s.res.n && !nitroShot) { nitroShot = true; await p.waitForTimeout(1200); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + PFX + '06-nitro-' + MODE + '.png' }); ok(true, 'nitro boost after 3 correct in a row (+' + s.res.d + ')'); }
    if (rounds === 8 && MODE === '3d') { const f = await st(); console.log('INFO fps', f.fps, JSON.stringify(f.info)); await p.click('[data-act=cam]'); await p.waitForTimeout(1500); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + PFX + '07-overview-' + MODE + '.png' }); await p.click('[data-act=cam]'); }
    if (s.car && s.car.fin && !s.finShot) { s.finShot = 1; }
  }
  ok(nitroShot, 'nitro seen');
  s = await until(s => s.status === 'finished', 30000); ok(s.status === 'finished', 'race finished after ' + (rounds + 2) + ' rounds');
  await p.waitForTimeout(800); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + PFX + '08-podium.png' }); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + PFX + '09-result-full.png', fullPage: true });
  const txt = await p.textContent('#result');
  ok(txt.includes('തെറ്റിയ ചോദ്യങ്ങൾ') && txt.includes('ശരിയുത്തരം'), 'review of wrong answers with correct answer');
  ok(!!(await p.$('a.academy[href*="zaman-smartphone-repair-academy"]')), 'academy button');
  const rank = await p.evaluate(() => ZRR.S.room.g.rank.indexOf(ZRR.S.me) + 1); ok(rank === 1, 'perfect player (after 1 breakdown) finished position ' + rank);
  // rematch gets a new question order
  const o1 = await p.evaluate(() => ZRR.S.room.g.qo.join());
  await p.click('#result [data-act=solo]'); await until(s => s.phase === 'count', 5000);
  const o2 = await p.evaluate(() => ZRR.S.room.g.qo.join()); ok(o1 !== o2, 'rematch uses a new shuffled question order');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 5)));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
