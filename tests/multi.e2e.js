// Multiplayer test with 3 phones (host racer, racer, spectator) against the local Firebase emulator (EMU=1) or live.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8766/';
const SH = process.env.SH || __dirname + '/../shots/'; const EMU = process.env.EMU; const MODE = process.env.MODE || '3d';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PWX, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mkc = async (mode) => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await c.addInitScript(([e, m]) => { if (e) localStorage.setItem('zrr_emu', JSON.stringify({ h: '127.0.0.1', p: 9000 })); localStorage.setItem('zrr_mode', JSON.stringify(m)); localStorage.setItem('zrr_fpsask', '1'); localStorage.setItem('zrr_voice', 'false'); }, [EMU, mode]);
    return c;
  };
  const pg = async c => { const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Permission denied|PERMISSION_DENIED|permission_denied|favicon|net::|fonts/i.test(m.text())) p.errs.push(m.text()); }); return p; };
  const st = p => p.evaluate(() => { const r = ZRR.S.room; if (!r) return null; const g = r.g || {}; const me = ZRR.S.me; return { status: r.status, phase: g.phase, r: g.r, seq: g.seq, car: g.cars && g.cars[me], res: g.res && g.res[me], role: r.players[me] && r.players[me].role, n: g.order && g.order.length, me, code: ZRR.S.code, locked: ZRR.chatLocked(), chat: ZRR.S.chat.length, qtext: g.phase === 'q' ? document.querySelector('.qtext') && document.querySelector('.qtext').textContent : '' }; });
  const until = async (p, fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await st(p).catch(() => null); if (s && fn(s)) return s; await p.waitForTimeout(150); } return st(p); };
  const correct = p => p.evaluate(() => ZRR.E.questionFor(ZRR.S.room, ZRR.S.me, questionSets).q.a);
  const top = p => p.evaluate(() => scrollTo(0, 0));
  const hc = await mkc(MODE), pc = await mkc('lite'), wc = await mkc(MODE);
  let H = await pg(hc), P = await pg(pc), W = await pg(wc);
  await H.goto(BASE); await H.fill('#nameIn', 'അൻവർ'); await H.click('[data-act=create]');
  await H.waitForSelector('.code', { timeout: 15000 }); const code = (await H.textContent('.code')).trim(); console.log('room', code);
  await P.goto(BASE + '?room=' + code); ok((await P.inputValue('#codeIn')) === code, 'share link fills the room code');
  await P.fill('#nameIn', 'സിയാദ്'); await P.click('[data-act=join]'); await P.waitForSelector('.code');
  await W.goto(BASE); await W.fill('#nameIn', 'കാണി'); await W.fill('#codeIn', code); await W.click('[data-act=joinSpec]'); await W.waitForSelector('.code');
  let s = await until(H, s => true); await H.waitForTimeout(1500);
  const lob = await H.textContent('#lobby'); ok(lob.includes('സിയാദ്') && lob.includes('കാണി') && lob.includes('(2/11)'), 'lobby: 2/11 racers + spectator synced');
  await top(H); await H.screenshot({ path: SH + '10-lobby-host.png', fullPage: true }); await P.screenshot({ path: SH + '11-lobby-player.png' });
  ok(!(await P.$('[data-act=start]')), 'only host sees start');
  // chat works in the lobby
  await P.click('#chatBtn'); await P.fill('#chatIn', 'ഹലോ, റെഡി!'); await P.click('.chatform [data-act=chatSend]');
  s = await until(H, s => s.chat >= 1, 8000); ok(s.chat >= 1, 'chat message arrives');
  await P.click('#chatBtn');
  await H.click('[data-act=start]');
  s = await until(P, s => s.phase === 'q', 15000); ok(s.phase === 'q' && s.n === 2, 'race started on all phones; checkpoint 1');
  const sw = await until(W, s => s.phase === 'q'); ok(sw.role === 's' && !sw.car, 'spectator watches, has no car');
  const sh = await until(H, s => s.phase === 'q');
  ok(sh.qtext && sh.qtext === s.qtext && sw.qtext === s.qtext, 'same question at the same time on every phone');
  ok(s.locked, 'chat locked while question is live');
  // rules: even a direct database write is refused while locked
  const direct = await P.evaluate(() => ZRR.S.chatRef.push({ pid: ZRR.S.me, name: 'x', tm: 'x', text: 'answer is 2', ts: firebase.database.ServerValue.TIMESTAMP }).then(() => 'written', e => 'denied'));
  ok(direct === 'denied', 'Firebase rules refuse chat while a question is live: ' + direct);
  await P.click('#chatBtn'); await P.waitForTimeout(300); await top(P); await P.screenshot({ path: SH + '12-mp-chat-locked.png' }); await P.click('[data-act=chatToggle]');
  ok(await W.$$eval('.opt', x => x.length > 0 && x.every(o => o.disabled)), 'spectator sees the question read-only');
  // host fast correct, P wrong
  let a = await correct(H); await H.click(`[data-act=ans][data-i="${a}"]`);
  let ap = await correct(P); await P.click(`[data-act=ans][data-i="${(ap + 1) % 4}"]`);
  s = await until(W, s => s.phase === 'rev', 8000); ok(s.phase === 'rev', 'round resolved as soon as both answered');
  const hr = await st(H), pr = await st(P); ok(hr.res.k === 'ok' && hr.car.d >= 4, 'host moved +' + hr.res.d); ok(pr.res.k === 'wrong' && pr.car.pit === 1, 'player 2 breakdown → pit');
  await W.waitForTimeout(1500); await top(W); await W.screenshot({ path: SH + '13-mp-spectator-reveal.png' });
  // round 2: P has pit question; reload P (app closed) → auto-rejoin
  s = await until(P, s => s.phase === 'q' && s.r === 1, 10000);
  await P.close(); P = await pg(pc); await P.goto(BASE);
  s = await until(P, s => s.status === 'racing' && s.phase === 'q', 15000); ok(s && s.code === code && s.car && s.car.pit === 1, 'reopened app → auto-rejoined the race (still in pit)');
  ok(!!(await P.$('.tagline.pit')), 'pit repair question after rejoin');
  ap = await correct(P); await P.click(`[data-act=ans][data-i="${ap}"]`); a = await correct(H); await H.click(`[data-act=ans][data-i="${a}"]`);
  s = await until(P, s => s.phase === 'rev' && s.r === 1); ok(s.res.k === 'fix', 'repair correct → back in race');
  // timeout: nobody answers round 3
  s = await until(H, s => s.phase === 'q' && s.r === 2, 10000); const t0 = Date.now();
  s = await until(H, s => s.phase === 'rev' && s.r === 2, 20000); ok(s.res.k === 'to', 'time out = breakdown (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  // play the rest quickly: both answer correct
  let guard = 0;
  while (guard++ < 40) {
    s = await until(H, s => s.status !== 'racing' || s.phase === 'q', 15000); if (s.status !== 'racing') break;
    const sq = s.seq;
    for (const X of [H, P]) { const x = await st(X); if (x.car && !x.car.fin && x.phase === 'q') { const c = await correct(X); await X.click(`[data-act=ans][data-i="${c}"]`).catch(() => {}); } }
    s = await until(H, s => s.status !== 'racing' || (s.phase === 'rev' && s.seq > sq), 15000);
    if (s.res && s.res.n && !H.nshot) { H.nshot = 1; await H.waitForTimeout(1300); await top(H); await H.screenshot({ path: SH + '14-mp-nitro-host.png' }); }
  }
  s = await until(W, s => s.status === 'finished', 20000); ok(s.status === 'finished', 'race finished on spectator phone too');
  await W.waitForTimeout(700); await top(W); await W.screenshot({ path: SH + '15-mp-podium-spectator.png' });
  await P.waitForTimeout(500); await P.screenshot({ path: SH + '16-mp-result-review.png', fullPage: true });
  const ptxt = await P.textContent('#result'); ok(ptxt.includes('ശരിയുത്തരം'), 'player 2 sees review of wrong answers');
  const s2 = await st(P); ok(s2.chat >= 1 && !s2.locked, 'chat open again after race');
  // rematch → lobby → new shuffled order
  const o1 = await H.evaluate(() => ZRR.S.room.g.qo.join());
  await H.click('[data-act=reset]'); await until(P, s => s.status === 'lobby', 8000); await H.click('[data-act=start]');
  await until(P, s => s.status === 'racing', 8000); const o2 = await P.evaluate(() => ZRR.S.room.g.qo.join());
  ok(o2 && o1 !== o2, 'rematch: new shuffled question order, same on every phone (' + (o2 === await H.evaluate(() => ZRR.S.room.g.qo.join())) + ')');
  for (const X of [H, P, W]) ok(X.errs.length === 0, 'no page errors ' + JSON.stringify(X.errs.slice(0, 3)));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
