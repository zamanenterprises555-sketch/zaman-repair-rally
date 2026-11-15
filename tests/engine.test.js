// node tests/engine.test.js
const E = require('../engine.js'); const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../questions.js', 'utf8'); const QS = new Function(src + '; return questionSets;')();
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
ok(E.setPlayable(QS, 'OPTIONAL QUESTIONS 1') && E.setPlayable(QS, 'OPTIONAL QUESTIONS 2'), 'both cricket sets are playable');
ok(E.stepsFor(2, 10) === 5 && E.stepsFor(4, 10) === 4 && E.stepsFor(7, 10) === 3 && E.stepsFor(10, 10) === 2 && E.stepsFor(10.5, 10) === -1, 'steps 5/4/3/2 scaled to 10 s');
ok(E.stepsFor(14, 60) === 5 && E.stepsFor(59, 60) === 2, 'steps scale to the 1-minute limit');
let t = 1000; let room = E.newRoom({ code: 'ABC234', pid: 'h', name: 'H', now: t });
const act = (a, by) => { const r = E.reduce(room, Object.assign({ by, now: t }, a), QS); if (!r.error) room = r.room; return r; };
for (let i = 1; i <= 12; i++) act({ type: 'join', pid: 'p' + i, name: 'P' + i }, 'p' + i);
ok(E.racerIds(room).length === 11, '11 racers max, 12th joins as spectator: ' + E.racerIds(room).length);
ok(room.players.p11.role === 's' && room.players.p12.role === 's', 'extra players are spectators');
ok(new Set(E.racerIds(room).map(id => room.players[id].col)).size === 11, '11 distinct colours');
ok(act({ type: 'role', role: 'r' }, 'p12').error, 'cannot become racer when 11 already');
act({ type: 'role', role: 's' }, 'p3'); ok(!act({ type: 'role', role: 'r' }, 'p12').error && room.players.p12.role === 'r', 'spectator takes a free seat');
ok(act({ type: 'start' }, 'p1').error, 'only host starts');
act({ type: 'start', seed: 7 }, 'h'); ok(room.status === 'racing' && room.g.order.length === 11 && room.g.phase === 'count', 'race starts with 11 cars');
ok(room.g.pool.length === 30 && room.g.pool.every(x => x.startsWith('OPTIONAL QUESTIONS 2')), 'pit questions come from the other set');
ok(act({ type: 'go' }, 'h').error, 'countdown must finish'); t += E.COUNT_MS; act({ type: 'go' }, 'p5'); ok(room.g.phase === 'q' && room.g.r === 0, 'round 1 live');
ok(room.g.startAt === room.g.qAt + 3000 && room.g.endAt === room.g.startAt + 10000, '3 s reading time before the 10 s answer timer');
ok(act({ type: 'answer', i: 0, t: 0 }, 'p6').error, 'answers disabled during reading time'); t += E.READ_MS;
// round 1: h fast correct, p1 wrong, others time out
const a0 = E.questionFor(room, 'h', QS).q.a;
act({ type: 'answer', i: a0, t: 1.2 }, 'h'); act({ type: 'answer', i: (a0 + 1) % 4, t: 2 }, 'p1');
ok(act({ type: 'answer', i: a0, t: 1 }, 'h').error, 'one answer per round');
ok(act({ type: 'resolve' }, 'h').error, 'waits for everyone (or time out)');
t += 10000 + E.GRACE_MS; act({ type: 'resolve' }, 'p2');
ok(room.g.prank.length === 11, 'previous positions saved for ▲/▼');
ok(room.g.cars.h.d === 5 && room.g.res.h.k === 'ok', 'fast correct = 5 steps');
ok(room.g.cars.p1.pit === 1 && room.g.res.p1.k === 'wrong' && room.g.cars.p1.d === 0, 'wrong = breakdown, car stops');
ok(room.g.res.p2.k === 'to' && room.g.cars.p2.pit === 1, 'time out = breakdown');
ok(room.g.miss.p1.length === 1 && room.g.miss.p1[0].c === (a0 + 1) % 4, 'wrong answer saved for review');
ok(act({ type: 'next' }, 'h').error, 'reveal waits'); t += E.REVEAL_MS; act({ type: 'next' }, 'h');
ok(room.g.r === 1 && room.g.phase === 'q' && room.g.startAt === room.g.qAt + 3000, 'round 2 (pit questions get reading time too)'); t += E.READ_MS;
const pq = E.questionFor(room, 'p1', QS); ok(pq.pit && pq.s === 'OPTIONAL QUESTIONS 2', 'pit car gets a repair question');
const pq2 = E.questionFor(room, 'p2', QS); ok(pq2.i !== pq.i, 'each pit car gets its own repair question');
act({ type: 'answer', i: pq.q.a, t: 3 }, 'p1');
t += 10600; act({ type: 'resolve' }, 'h');
ok(room.g.cars.p1.pit === 0 && room.g.res.p1.k === 'fix' && room.g.cars.p1.d === 0 && room.g.cars.p1.b >= 60, 'pit repair correct: back in race, did not move this round, battery charged');
ok(room.g.cars.p2.pit === 1 && room.g.res.p2.k === 'pitfail', 'pit repair missed: stays in pit');
// solo full race with nitro and finish
t = 5000; room = E.newRoom({ code: 'SOLO01', pid: 'me', name: 'Me', now: t, solo: true });
room.players.b1 = { name: 'B1', role: 'r', col: 1, bot: true, online: true, joinedAt: t + 1 };
act({ type: 'start', seed: 3 }, 'solo'); t += E.COUNT_MS; act({ type: 'go' }, 'solo'); t += E.READ_MS;
let nitroSeen = 0, rounds = 0;
let guard = 0; while (room.status === 'racing' && guard++ < 300) {
  const g = room.g;
  if (g.phase === 'q') { const x = E.questionFor(room, 'me', QS); if (!g.cars.me.fin) act({ type: 'answer', pid: 'me', i: x.q.a, t: 1 }, 'solo'); var rr = act({ type: 'resolve', bots: { b1: { r: g.r, i: (x.q.a + 1) % 4, t: 3 } } }, 'solo'); if (rr.error) { console.log('resolve err', rr.error, g.r, JSON.stringify(g.cars.me)); break; } if (room.g.res.me && room.g.res.me.n) nitroSeen++; rounds++; }
  else if (g.phase === 'rev') { t += E.REVEAL_MS; act({ type: 'next' }, 'solo'); t += E.READ_MS; }
  else break;
}
ok(nitroSeen >= 3, 'nitro after every 3 correct in a row: ' + nitroSeen);
ok(room.status === 'finished' && room.g.cars.me.fin === 1 && room.g.rank[0] === 'me', 'perfect player finishes 1st at checkpoint ' + (room.g.cars.me.fr + 1) + ' of 30 (nitro); race ran ' + rounds + ' rounds');
ok(room.g.cars.me.d >= E.FINISH, 'distance ' + room.g.cars.me.d + ' >= ' + E.FINISH);
ok(room.g.cars.me.b < 100 && room.g.cars.me.b > 0, 'battery used by nitro: ' + room.g.cars.me.b + '%');
// shuffling
{
  let r1 = E.newRoom({ code: 'SHUF01', pid: 'a', name: 'A', now: 1, solo: true }), r2 = E.clone(r1);
  r1 = E.reduce(r1, { type: 'start', by: 'solo', now: 1, seed: 111 }, QS).room; r2 = E.reduce(r2, { type: 'start', by: 'solo', now: 1, seed: 999 }, QS).room;
  ok(new Set(r1.g.qo).size === 30, 'checkpoint questions: 30 different, no repeats');
  ok(r1.g.qo.join() !== r2.g.qo.join(), 'a new race gets a new question order');
  ok(r1.g.qo.join() !== QS['OPTIONAL QUESTIONS 1'].map((q, i) => 'OPTIONAL QUESTIONS 1|' + i).join(), 'order is shuffled');
  let good = 0, moved = 0;
  r1.g.qo.forEach((ref, k) => { const x = E.qOf(QS, ref, r1.g.qp[k]); const orig = QS[x.s][x.i]; if (x.q.o[x.q.a] === orig.o[orig.a] && x.q.q === orig.q && x.q.o.slice().sort().join() === orig.o.slice().sort().join()) good++; if (x.q.a !== orig.a) moved++; });
  ok(good === 30, 'shuffled options keep the right answer (30/30)');
  ok(moved >= 10, 'options really shuffled (' + moved + '/30 answers moved)');
  let pg = 0; r1.g.pool.forEach((ref, k) => { const x = E.qOf(QS, ref, r1.g.pp[k]); const o = QS[x.s][x.i]; if (x.q.o[x.q.a] === o.o[o.a]) pg++; });
  ok(pg === r1.g.pool.length && new Set(r1.g.pool).size === r1.g.pool.length, 'pit questions shuffled, correct mapping, no repeats');
  const src2 = fs.readFileSync(__dirname + '/../questions.js', 'utf8'); ok(src2 === fs.readFileSync('/workspace/zaman-cricket-quiz/questions.js', 'utf8'), 'questions.js unchanged (same as cricket quiz)');
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
