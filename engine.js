/* Zaman Repair Rally - race engine (v1)
 * Pure rules shared by Solo and Multiplayer. Solo applies actions to a local
 * copy; multiplayer applies the SAME actions inside a Firebase transaction.
 * Questions come from questions.js (the same file as Zaman Cricket Quiz).
 */
(function (root) {
  'use strict';
  var LAPS = 3, CPS = 10, ROUNDS = LAPS * CPS, LAP_STEPS = 50, FINISH = LAPS * LAP_STEPS;
  var MAX_RACERS = 11, MIN_RACERS = 2, SET_SIZE = 30, MAX_PLAYERS = 40;
  var REVEAL_MS = 4500, COUNT_MS = 3000, GRACE_MS = 600, READ_MS = 3000; // READ_MS: calm reading time before the answer timer starts
  var NITRO_EVERY = 3, NITRO_BONUS = 3, NITRO_COST = 12, NITRO_MIN = 15;
  var BAT_START = 100, BAT_DRIVE = 4, BAT_OK = 6, BAT_TOPIC = 14, BAT_WRONG = 15, BAT_LOW = 20, BAT_PIT = 60;
  // Same set types and time limits as the cricket quiz.
  var SET_TYPES = [
    { key: 'OPTIONAL QUESTIONS', ml: 'ഓപ്ഷൻ ചോദ്യങ്ങൾ', limit: 10, re: /^OPTIONAL/ },
    { key: 'ONE WORD QUESTIONS', ml: 'ഒറ്റവാക്ക് ഉത്തരം', limit: 60, re: /^ONE\s*WORD/ },
    { key: 'MINIMUM 3 SENTENCES', ml: 'കുറഞ്ഞത് 3 വാക്യം', limit: 180, re: /^MINIMUM\s*3/ },
    { key: 'MINIMUM 5 SENTENCES', ml: 'കുറഞ്ഞത് 5 വാക്യം', limit: 300, re: /^MINIMUM\s*5/ },
    { key: 'PICTURE IDENTIFYING', ml: 'ചിത്രം തിരിച്ചറിയൽ', limit: 300, re: /^PICTURE/ }
  ];
  // steps by answer time, as fractions of the time limit
  var BANDS = [[0.25, 5], [0.5, 4], [0.75, 3], [1.0, 2]];
  var COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#00acc1', '#f06292', '#ffffff', '#6d4c41', '#c0ca33'];
  var COLOR_ML = ['ചുവപ്പ്', 'നീല', 'മഞ്ഞ', 'പച്ച', 'ഓറഞ്ച്', 'വയലറ്റ്', 'സിയാൻ', 'പിങ്ക്', 'വെള്ള', 'ബ്രൗൺ', 'ലൈം'];
  var TOPIC = /ബാറ്ററ|ചാർജ|പവർ|വോൾട്ട|battery|charg|power|volt|mah/i;

  function setType(name) {
    var n = String(name || '').toUpperCase().replace(/\s+/g, ' ').trim();
    for (var i = 0; i < SET_TYPES.length; i++) if (SET_TYPES[i].re.test(n)) return SET_TYPES[i];
    return null;
  }
  function limitFor(setName) { var t = setType(setName); return t ? t.limit : 10; }
  function stepsFor(t, limit) {
    if (!(t >= 0 && t <= limit)) return -1;
    for (var i = 0; i < BANDS.length; i++) if (t <= BANDS[i][0] * limit + 1e-9) return BANDS[i][1];
    return 2;
  }
  function bands(limit) { var prev = 0; return BANDS.map(function (b) { var r = { from: prev, to: b[0] * limit, steps: b[1] }; prev = r.to; return r; }); }
  function isMcq(q) { return !!q && Array.isArray(q.o) && q.o.length > 1 && typeof q.a === 'number'; }
  function setNumber(name) { var m = String(name).match(/(\d+)\s*$/); return m ? +m[1] : 0; }
  // A race needs 30 multiple-choice questions (one per checkpoint).
  function setPlayable(qs, name) {
    var a = qs && qs[name];
    return !!(a && setType(name) && a.length >= SET_SIZE && a.slice(0, SET_SIZE).every(isMcq));
  }
  function listSets(qs) {
    qs = qs || {};
    return SET_TYPES.map(function (t) {
      var sets = Object.keys(qs).filter(function (k) { var st = setType(k); return st && st.key === t.key; })
        .sort(function (a, b) { return setNumber(a) - setNumber(b); })
        .map(function (k) { return { name: k, count: (qs[k] || []).length, ok: setPlayable(qs, k) }; });
      return { type: t, sets: sets };
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rnd(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  function racerIds(room) {
    return Object.keys(room.players || {}).filter(function (id) { return room.players[id].role === 'r'; })
      .sort(function (a, b) { return (room.players[a].joinedAt || 0) - (room.players[b].joinedAt || 0) || (a < b ? -1 : 1); });
  }
  function freeColor(room) {
    var used = {}; racerIds(room).forEach(function (id) { used[room.players[id].col] = 1; });
    for (var i = 0; i < COLORS.length; i++) if (!used[i]) return i;
    return 0;
  }
  function newRoom(o) {
    var r = { v: 1, code: o.code, host: o.pid, createdAt: o.now || 0, solo: !!o.solo, status: 'lobby', set: o.set || 'OPTIONAL QUESTIONS 1', players: {} };
    r.players[o.pid] = { name: o.name, role: 'r', col: 0, online: true, joinedAt: o.now || 0 };
    if (o.th) r.players[o.pid].th = o.th;
    return r;
  }
  function normalize(room) {
    if (!room) return room;
    room.players = room.players || {};
    Object.keys(room.players).forEach(function (id) { var p = room.players[id]; if (!p.role) p.role = 's'; if (p.col == null) p.col = 0; });
    var g = room.g;
    if (g) {
      g.order = g.order || []; g.cars = g.cars || {}; g.ans = g.ans || {}; g.res = g.res || {}; g.miss = g.miss || {}; g.pool = g.pool || []; g.pq = g.pq || {}; g.prank = g.prank || []; g.qo = g.qo || []; g.qp = g.qp || []; g.pp = g.pp || [];
      g.order.forEach(function (id) {
        var c = g.cars[id] = g.cars[id] || {};
        ['d', 'st', 'pit', 'fin', 'ok', 'tt', 'nit', 'brk', 'lane'].forEach(function (k) { c[k] = c[k] || 0; });
        if (c.b == null) c.b = BAT_START;
        if (c.fr == null) c.fr = -1;
        g.miss[id] = g.miss[id] || [];
      });
    }
    return room;
  }
  function online(room, id) { var p = room.players[id]; return !!(p && (p.online || p.bot)); }
  function isAdmin(room, by) {
    if (by === 'solo' || by === room.host) return true;
    if (online(room, room.host)) return false;
    var on = racerIds(room).filter(function (id) { return online(room, id) && !room.players[id].bot; });
    return on[0] === by;
  }
  // option order for one question, e.g. "2031" (display index -> original index)
  function permute(q, pm) {
    if (!q || !pm || !isMcq(q)) return q;
    var idx = String(pm).split('').map(Number);
    if (idx.length !== q.o.length) return q;
    return { q: q.q, o: idx.map(function (k) { return q.o[k]; }), a: idx.indexOf(q.a), type: q.type };
  }
  function qOf(qs, ref, pm) { var p = String(ref).split('|'); var a = qs[p[0]] || []; return { s: p[0], i: +p[1], q: permute(a[+p[1]], pm), pm: pm || '' }; }
  // question a car must answer this round: the (shuffled) checkpoint question, or its repair question in the pit
  function questionFor(room, id, qs) {
    var g = room.g, c = g.cars[id];
    if (!c) return null;
    var x;
    if (c.pit) { var k = (g.pq[id] || 0) % g.pool.length; x = qOf(qs, g.pool[k], (g.pp || [])[k]); x.pit = true; return x; }
    if (g.qo && g.qo.length) { x = qOf(qs, g.qo[g.r % g.qo.length], (g.qp || [])[g.r % g.qo.length]); x.pit = false; return x; }
    return { s: g.set, i: g.r, q: (qs[g.set] || [])[g.r], pit: false, pm: '' };
  }
  function activeIds(room) { var g = room.g; return g.order.filter(function (id) { return !g.cars[id].fin; }); }
  function waitIds(room) { return activeIds(room).filter(function (id) { var p = room.players[id]; return p && !p.bot && p.online !== false; }); }
  function answered(room, id) { var a = room.g.ans[id]; return !!(a && a.r === room.g.r); }
  function allAnswered(room) { return waitIds(room).every(function (id) { return answered(room, id); }); }
  function ranking(room) {
    var g = room.g;
    return g.order.slice().sort(function (a, b) {
      var A = g.cars[a], B = g.cars[b];
      if (A.fin && B.fin) return A.fin - B.fin;
      if (A.fin || B.fin) return A.fin ? -1 : 1;
      return B.d - A.d || B.ok - A.ok || A.tt - B.tt || (a < b ? -1 : 1);
    });
  }
  // base = when the question appears; answers open (and the timer starts) READ_MS later
  function startRound(g, base) {
    g.phase = 'q'; g.ans = {}; g.pq = {}; g.qAt = base; g.startAt = base + READ_MS;
    g.order.forEach(function (id) { var c = g.cars[id]; if (c.pit && !c.fin) g.pq[id] = g.pptr++; });
    g.endAt = g.startAt + g.limit * 1000;
  }

  function reduce(roomIn, a, qs) {
    var room = normalize(clone(roomIn)); var P = room.players; var g = room.g;
    function err(m) { return { error: m }; }
    var t = a.type, nowT = a.now || 0;
    if (t === 'join') {
      if (!a.pid) return err('?');
      var p = P[a.pid];
      if (p) { p.online = true; if (a.name) p.name = String(a.name).slice(0, 20); if (a.th) p.th = a.th; return { room: room }; }
      if (Object.keys(P).length >= MAX_PLAYERS) return err('റൂം നിറഞ്ഞു');
      var asRacer = room.status === 'lobby' && racerIds(room).length < MAX_RACERS && !a.spec;
      P[a.pid] = { name: String(a.name || 'കളിക്കാരൻ').slice(0, 20), role: asRacer ? 'r' : 's', col: asRacer ? freeColor(room) : 0, online: true, joinedAt: nowT };
      if (a.th) P[a.pid].th = a.th;
      return { room: room };
    }
    if (t === 'role') { // switch between racer and spectator in the lobby
      var who = a.pid || a.by, pp = P[who];
      if (!pp || room.status !== 'lobby') return err('ലോബിയിൽ മാത്രം മാറ്റാം');
      if (who !== a.by && !isAdmin(room, a.by)) return err('ഹോസ്റ്റിന് മാത്രം');
      if (a.role === 'r') {
        if (pp.role === 'r') return { room: room };
        if (racerIds(room).length >= MAX_RACERS) return err('11 റേസർമാർ ആയി. കാണിയായി ഇരിക്കാം');
        pp.col = freeColor(room); pp.role = 'r';
      } else pp.role = 's';
      return { room: room };
    }
    if (t === 'setSet') {
      if (!isAdmin(room, a.by) || room.status !== 'lobby') return err('ഹോസ്റ്റിന് മാത്രം');
      if (!setPlayable(qs, a.set)) return err('ഈ സെറ്റ് ഉടൻ വരുന്നു');
      room.set = a.set; return { room: room };
    }
    if (t === 'start') {
      if (!isAdmin(room, a.by)) return err('ഹോസ്റ്റിന് മാത്രം തുടങ്ങാം');
      if (room.status !== 'lobby') return err('റേസ് തുടങ്ങിക്കഴിഞ്ഞു');
      if (!setPlayable(qs, room.set)) return err('കളിക്കാൻ പറ്റുന്ന സെറ്റ് തിരഞ്ഞെടുക്കുക');
      var ids = racerIds(room).slice(0, MAX_RACERS);
      if (ids.length < (room.solo ? 1 : MIN_RACERS)) return err('കുറഞ്ഞത് 2 റേസർമാർ വേണം');
      // repair (pit) questions: from the other playable sets, else from this set
      var pool = [];
      Object.keys(qs).forEach(function (k) { if (k !== room.set && setPlayable(qs, k)) qs[k].forEach(function (q, i) { if (isMcq(q)) pool.push(k + '|' + i); }); });
      if (!pool.length) qs[room.set].forEach(function (q, i) { pool.push(room.set + '|' + i); });
      // new random order for every race (and every rematch); stored in the room so all phones match
      var R = rnd(a.seed || 12345);
      function shuf(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)); var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; } return arr; }
      function perm(ref) { var q = qOf(qs, ref).q; if (!isMcq(q) || q.o.length > 10) return ''; return shuf(q.o.map(function (o, k) { return k; })).join(''); }
      var qo = shuf(qs[room.set].map(function (q, i) { return room.set + '|' + i; })).slice(0, ROUNDS);
      shuf(pool);
      var qp = qo.map(perm), pp = pool.map(perm);
      var cars = {};
      ids.forEach(function (id, k) { cars[id] = { d: 0, b: BAT_START, st: 0, pit: 0, fin: 0, fr: -1, ok: 0, tt: 0, nit: 0, brk: 0, lane: k }; });
      room.status = 'racing';
      room.g = { set: room.set, limit: limitFor(room.set), order: ids, cars: cars, r: 0, phase: 'count', startAt: nowT + COUNT_MS, endAt: nowT + COUNT_MS, ans: {}, res: {}, resR: -1, miss: {}, pool: pool, pp: pp, qo: qo, qp: qp, pptr: 0, pq: {}, finN: 0, seq: 0 };
      return { room: room };
    }
    if (!g) return err('റേസ് ഇല്ല');
    if (t === 'go') {
      if (g.phase !== 'count' || nowT < g.startAt - 50) return err('wait');
      startRound(g, g.startAt); g.seq++; return { room: room };
    }
    if (t === 'answer') {
      if (g.phase !== 'q') return err('സമയം കഴിഞ്ഞു');
      if (nowT < g.startAt - 250) return err('ആദ്യം ചോദ്യം വായിക്കൂ');
      var aw = (a.by === 'solo' && a.pid) ? a.pid : a.by;
      var c0 = g.cars[aw]; if (!c0 || c0.fin) return err('?');
      if (answered(room, aw)) return err('ഉത്തരം നൽകിക്കഴിഞ്ഞു');
      g.ans[aw] = { r: g.r, i: +a.i, t: Math.max(0, +a.t || 0) };
      return { room: room };
    }
    if (t === 'resolve') {
      if (g.phase !== 'q') return err('wait');
      if (!(allAnswered(room) || nowT >= g.endAt + GRACE_MS)) return err('wait');
      var bots = a.bots || {};
      g.prank = ranking(room);
      var res = {}, finishers = [];
      g.order.forEach(function (id) {
        var c = g.cars[id]; if (c.fin) return;
        var x = questionFor(room, id, qs), q = x.q;
        var an = (P[id] && P[id].bot) ? bots[id] : g.ans[id];
        if (an && an.r != null && an.r !== g.r) an = null;
        var tm = an ? Math.max(0, +an.t) : g.limit + 1, ch = an ? +an.i : -1;
        var correct = !!(an && q && ch === q.a && tm <= g.limit + 0.5);
        tm = Math.min(tm, g.limit + 1);
        var r = { k: '', d: 0, c: ch, s: x.s, i: x.i, pm: x.pm || '' };
        if (!correct) c.tt += g.limit; else c.tt += tm;
        if (c.pit) {
          if (correct) { c.pit = 0; c.b = Math.max(c.b, BAT_PIT); r.k = 'fix'; c.ok++; }
          else { r.k = 'pitfail'; g.miss[id].push({ s: x.s, i: x.i, c: an ? ch : -1, p: 1, pm: x.pm || '' }); }
        } else if (correct) {
          var steps = stepsFor(Math.min(tm, g.limit), g.limit); if (steps < 2) steps = 2;
          if (c.b < BAT_LOW) { steps = Math.max(1, steps - 1); r.lo = 1; }
          c.b = Math.min(100, c.b + BAT_OK + (TOPIC.test((q.q || '') + ' ' + (q.o[q.a] || '')) ? BAT_TOPIC : 0)) ;
          c.b = Math.max(0, c.b - BAT_DRIVE);
          c.st++; c.ok++;
          if (c.st % NITRO_EVERY === 0) {
            if (c.b >= NITRO_MIN) { steps += NITRO_BONUS; c.b -= NITRO_COST; c.nit++; r.n = 1; }
            else r.nn = 1; // nitro earned, battery too low
          }
          r.d = steps; r.k = 'ok'; c.d += steps;
          if (c.d >= FINISH) finishers.push({ id: id, t: tm });
        } else {
          c.b = Math.max(0, c.b - BAT_WRONG); c.st = 0; c.pit = 1; c.brk++;
          r.k = an ? 'wrong' : 'to';
          g.miss[id].push({ s: x.s, i: x.i, c: an ? ch : -1, pm: x.pm || '' });
        }
        res[id] = r;
      });
      finishers.sort(function (x, y) { return x.t - y.t; }).forEach(function (f) { g.finN++; g.cars[f.id].fin = g.finN; g.cars[f.id].fr = g.r; res[f.id].fin = g.finN; });
      g.res = res; g.resR = g.r; g.ans = {}; g.phase = 'rev'; g.revEnd = nowT + REVEAL_MS; g.seq++;
      g.over = (activeIds(room).length === 0 || g.r >= ROUNDS - 1) ? 1 : 0;
      return { room: room };
    }
    if (t === 'next') {
      if (g.phase !== 'rev' || nowT < g.revEnd - 50) return err('wait');
      if (g.over) { room.status = 'finished'; g.phase = 'done'; g.rank = ranking(room); g.seq++; return { room: room }; }
      g.r++; startRound(g, g.revEnd); g.seq++;
      return { room: room };
    }
    if (t === 'reset') {
      if (!isAdmin(room, a.by)) return err('ഹോസ്റ്റിന് മാത്രം');
      room.status = 'lobby'; room.g = null; return { room: room };
    }
    return err('?');
  }

  var api = {
    LAPS: LAPS, CPS: CPS, ROUNDS: ROUNDS, LAP_STEPS: LAP_STEPS, FINISH: FINISH, MAX_RACERS: MAX_RACERS, MIN_RACERS: MIN_RACERS, SET_SIZE: SET_SIZE,
    REVEAL_MS: REVEAL_MS, COUNT_MS: COUNT_MS, GRACE_MS: GRACE_MS, READ_MS: READ_MS, NITRO_EVERY: NITRO_EVERY, NITRO_BONUS: NITRO_BONUS, BAT_LOW: BAT_LOW, BAT_PIT: BAT_PIT,
    COLORS: COLORS, COLOR_ML: COLOR_ML, SET_TYPES: SET_TYPES,
    setType: setType, limitFor: limitFor, stepsFor: stepsFor, bands: bands, isMcq: isMcq, listSets: listSets, setPlayable: setPlayable,
    newRoom: newRoom, normalize: normalize, reduce: reduce, racerIds: racerIds, ranking: ranking, questionFor: questionFor, qOf: qOf, permute: permute,
    activeIds: activeIds, waitIds: waitIds, answered: answered, allAnswered: allAnswered, isAdmin: isAdmin, clone: clone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(this);
