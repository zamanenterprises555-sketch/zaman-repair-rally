// 11 racers + 1 extra (becomes spectator) in one room, against the emulator (EMU=1).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8766/'; const SH = process.env.SH || __dirname + '/../shots/'; const EMU = process.env.EMU;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PWX, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pages = [];
  for (let i = 0; i < 12; i++) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: i === 0 ? 2 : 1, isMobile: true });
    await c.addInitScript(([e, m]) => { if (e) localStorage.setItem('zrr_emu', JSON.stringify({ h: '127.0.0.1', p: 9000 })); localStorage.setItem('zrr_mode', JSON.stringify(m)); localStorage.setItem('zrr_fpsask', '1'); localStorage.setItem('zrr_voice', 'false'); }, [EMU, i === 0 ? 'x' : 'x']);
    const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); pages.push(p);
  }
  const st = p => p.evaluate(() => { const r = ZRR.S.room; if (!r) return null; const g = r.g || {}; return { status: r.status, phase: g.phase, r: g.r, seq: g.seq, n: g.order && g.order.length, role: r.players[ZRR.S.me] && r.players[ZRR.S.me].role, res: g.res && g.res[ZRR.S.me], fps: ZRR.S.view && ZRR.S.view.fps() }; });
  const until = async (p, fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await st(p).catch(() => null); if (s && fn(s)) return s; await p.waitForTimeout(200); } return st(p); };
  const H = pages[0];
  await H.goto(BASE); await H.fill('#nameIn', 'അൻവർ'); await H.click('[data-act=create]'); await H.waitForSelector('.code', { timeout: 15000 });
  const code = (await H.textContent('.code')).trim();
  const names = ['സിയാദ്', 'ഫൈസൽ', 'റാഷിദ്', 'നൗഷാദ്', 'ഷമീർ', 'അജ്മൽ', 'ജാബിർ', 'ഹാരിസ്', 'സലീം', 'മുനീർ', 'അധിക'];
  for (let i = 1; i < 12; i++) { const p = pages[i]; await p.goto(BASE + '?room=' + code); await p.fill('#nameIn', names[i - 1]); await p.click('[data-act=join]'); await p.waitForSelector('.code', { timeout: 15000 }); await p.waitForTimeout(300); }
  await H.waitForTimeout(2500);
  const lob = await H.textContent('#lobby'); ok(lob.includes('(11/11)'), 'lobby shows 11/11 racers');
  const s12 = await st(pages[11]); ok(s12.role === 's', '12th person is a spectator (racers max 11)');
  await H.evaluate(() => scrollTo(0, 0)); await H.screenshot({ path: SH + 'v2-mp-17-lobby-11-racers.png', fullPage: true });
  await H.click('[data-act=start]');
  let s = await until(H, s => s.phase === 'q' && s.r === 0, 15000); ok(s.n === 11, 'race with 11 cars');
  // everybody answers at once (the correct answer), concurrently
  await Promise.all(pages.slice(0, 11).map(async p => { await until(p, s => s.phase === 'q' && !!s.n, 10000); await p.waitForSelector('[data-act=ans]', { timeout: 10000 }); return p.evaluate(() => { const a = ZRR.E.questionFor(ZRR.S.room, ZRR.S.me, questionSets).q.a; document.querySelector('[data-act=ans][data-i="' + a + '"]').click(); }); }));
  const all = await Promise.all(pages.map(p => st(p))); ok(all.every(x => x.status === 'racing'), 'all 12 phones in the race');
  s = await until(H, s => s.phase === 'rev', 15000); ok(s.phase === 'rev', 'resolved after 11 simultaneous answers');
  const moved = await H.evaluate(() => { const g = ZRR.S.room.g; console.log(JSON.stringify(g.res)); return g.order.filter(id => g.res[id] && (g.res[id].k === 'ok' || g.res[id].k === 'fix')).length; }); console.log('RES', await H.evaluate(() => JSON.stringify(Object.values(ZRR.S.room.g.res).map(x => x.k + ':' + x.c)))); ok(moved === 11, 'all 11 answers counted (' + moved + ')');
  await H.waitForTimeout(2200); await H.screenshot({ path: SH + 'v2-mp-18-11-cars-racebar.png' });
  s = await st(H); 
  ok(pages.every(p => p.errs.length === 0), 'no page errors');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
