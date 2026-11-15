/* Zaman Repair Rally v1 - UI, rooms (Firebase RTDB: rallyRooms/, rallyChat/), Solo, 3D view.
 * Race rules are in engine.js, questions in questions.js (same file as the cricket quiz). */
(function () {
'use strict';
var firebaseConfig = {
  apiKey: "AIzaSyBKQQRIcz1eEsz-V0r8WYsOCXBjAsR6XNQ",
  authDomain: "zaman-6587f.firebaseapp.com",
  databaseURL: "https://zaman-6587f-default-rtdb.firebaseio.com",
  projectId: "zaman-6587f",
  storageBucket: "zaman-6587f.firebasestorage.app",
  messagingSenderId: "985807833692",
  appId: "1:985807833692:web:4d331bd0b2e8db0fcdb499"
};
var ACADEMY = 'https://zamanenterprises555-sketch.github.io/zaman-smartphone-repair-academy/';
var ROOMS = 'rallyRooms/', CHAT = 'rallyChat/';
var E = window.Engine, QS = (typeof questionSets !== 'undefined') ? questionSets : {};
var db = null;
try { if (window.firebase) { firebase.initializeApp(firebaseConfig); db = firebase.database(); var emu = null; try { emu = JSON.parse(localStorage.getItem('zrr_emu') || 'null'); } catch (e) {} if (emu && emu.h) db.useEmulator(emu.h, emu.p); } } catch (e) { db = null; } // zrr_emu: local rules testing only

var $ = function (s) { return document.querySelector(s); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};
var S = { room: null, me: null, solo: false, ref: null, code: null, offset: 0, chat: [], chatUnread: 0, chatOpen: false, view: null, viewMode: null, spokenSeq: null, popSeq: null, panelKey: '', tick: null, tryAt: {}, homeSet: null, mySel: null };
function chatLocked() { var g = S.room && S.room.g; return !!(S.room && S.room.status === 'racing' && g && g.phase === 'q'); }
window.ZRR = { S: S, E: E, chatLocked: chatLocked };

function deviceId() { var id = LS.get('zrr_pid'); if (!id) { id = 'p' + Math.random().toString(36).slice(2, 10); LS.set('zrr_pid', id); } return id; }
function serverNow() { return Date.now() + (S.solo ? 0 : S.offset); }
function toast(msg, ok) { var t = $('#toast'); t.textContent = msg; t.className = 'toast' + (ok ? ' ok' : ''); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2800); }
function col(i) { return E.COLORS[(+i || 0) % E.COLORS.length]; }
function nm(id) { var p = S.room && S.room.players[id]; return p ? p.name : '—'; }
function fmtT(sec) { sec = Math.max(0, sec); if (sec >= 60) { var m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + ':' + (s < 10 ? '0' : '') + s; } return String(Math.ceil(sec)); }
function limitTxt(L) { return L >= 60 ? (L / 60) + ' മിനിറ്റ്' : L + ' സെക്കൻഡ്'; }
function voiceOn() { return LS.get('zrr_voice', true); }
function mlVoice() { try { return (speechSynthesis.getVoices() || []).filter(function (x) { return /^ml/i.test(x.lang); })[0] || null; } catch (e) { return null; } }
function speak(text) {
  try {
    if (!voiceOn() || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = 'ml-IN'; u.rate = 0.95;
    var v = mlVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function speakQ(q) { if (!q) return; var n = ['ഒന്ന്', 'രണ്ട്', 'മൂന്ന്', 'നാല്', 'അഞ്ച്', 'ആറ്']; speak(q.q + '. ' + (q.o || []).map(function (o, i) { return (n[i] || (i + 1)) + ': ' + o; }).join('. ')); }
function carSvg(c, w) { return '<svg class="carsvg" viewBox="0 0 64 30" width="' + (w || 40) + '" aria-hidden="true"><path d="M4 20 L8 12 Q10 10 14 10 L22 10 L28 4 Q30 3 33 3 L44 3 Q47 3 49 6 L53 11 L58 12 Q61 13 61 16 L61 21 Q61 23 59 23 L5 23 Q3 23 4 20Z" fill="' + c + '" stroke="rgba(0,0,0,.5)" stroke-width="1"/><path d="M30 5.5 L44 5.5 Q46 5.5 47 7 L50 11 L26 11Z" fill="#0d1522"/><circle cx="16" cy="23" r="5.5" fill="#151515"/><circle cx="16" cy="23" r="2.2" fill="#b8bec8"/><circle cx="49" cy="23" r="5.5" fill="#151515"/><circle cx="49" cy="23" r="2.2" fill="#b8bec8"/><rect x="57" y="14" width="3.5" height="2.5" fill="#fff3b0"/></svg>'; }

// ------------------------------------------------------------ dispatch
function dispatch(a, silent) {
  a.by = a.by || (S.solo ? 'solo' : S.me); a.now = serverNow();
  if (S.solo) {
    var r = E.reduce(S.room, a, QS);
    if (r.error) { if (!silent) toast(r.error); return Promise.resolve(false); }
    S.room = r.room; LS.set('zrr_solo', S.room); render(); return Promise.resolve(true);
  }
  if (!S.ref) return Promise.resolve(false);
  var err = null; S.tx = (S.tx || 0) + 1;
  return S.ref.transaction(function (cur) {
    if (cur === null) return cur;
    var r = E.reduce(E.normalize(cur), a, QS);
    if (r.error) { err = r.error; return; }
    err = null; return r.room;
  }).then(function () { S.tx--; if (err) { if (!silent) toast(err); return false; } return true; })
    .catch(function (e) { S.tx--; console.warn('tx', e && e.message); if (!silent) toast('ഇന്റർനെറ്റ് പ്രശ്നം. വീണ്ടും ശ്രമിക്കുക'); return false; });
}

// ------------------------------------------------------------ rooms
function genCode() { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function myName() { var el = $('#nameIn'); var n = (el ? el.value : LS.get('zrr_name', '')).trim().slice(0, 20); if (n) LS.set('zrr_name', n); return n; }
function randTok() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
function sha(t) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
function baseUrl() { return location.origin + location.pathname; }
function rejoinUrl() { var s = LS.get('zrr_session'); if (!s || !s.tok || S.solo) return ''; return baseUrl() + '?r=' + s.code + '&p=' + s.pid + '&k=' + s.tok; }
function firstPlayable() { var l = E.listSets(QS); for (var i = 0; i < l.length; i++) for (var j = 0; j < l[i].sets.length; j++) if (l[i].sets[j].ok) return l[i].sets[j].name; return null; }

function createRoom() {
  if (!db) return toast('ഇന്റർനെറ്റ് ഇല്ല. സോളോ കളിക്കാം');
  var name = myName(); if (!name) return toast('ആദ്യം നിങ്ങളുടെ പേര് നൽകുക');
  var code = genCode(), pid = deviceId(), tok = randTok();
  var ref = db.ref(ROOMS + code);
  Promise.all([ref.once('value'), sha(tok)]).then(function (res) {
    if (res[0].exists()) return createRoom();
    var room = E.newRoom({ code: code, pid: pid, name: name, now: serverNow(), th: res[1], set: S.homeSet || firstPlayable() });
    return ref.set(room).then(function () { connect(code, pid, name, tok); });
  }).catch(function (e) { console.warn(e); toast(/permission/i.test(e && e.message) ? 'മൾട്ടിപ്ലെയർ ഇപ്പോൾ തയ്യാറായിട്ടില്ല (Firebase നിയമം ഇടണം). സോളോ കളിക്കാം' : 'റൂം ഉണ്ടാക്കാൻ പറ്റിയില്ല'); });
}
function joinRoom(codeIn, spec) {
  if (!db) return toast('ഇന്റർനെറ്റ് ഇല്ല');
  var code = String(codeIn || ($('#codeIn') ? $('#codeIn').value : '')).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  var name = myName();
  if (!name) return toast('ആദ്യം നിങ്ങളുടെ പേര് നൽകുക');
  if (code.length !== 6) return toast('ശരിയായ 6 അക്ഷര റൂം കോഡ് നൽകുക');
  var pid = deviceId();
  db.ref(ROOMS + code).once('value').then(function (s) {
    if (!s.exists()) return toast('ഈ കോഡിൽ റൂം ഇല്ല');
    var ses = LS.get('zrr_session');
    var tok = (ses && ses.code === code && ses.pid === pid && ses.tok) ? ses.tok : randTok();
    connect(code, pid, name, tok, spec);
  }).catch(function (e) { toast(/permission/i.test(e && e.message) ? 'മൾട്ടിപ്ലെയർ ഇപ്പോൾ തയ്യാറായിട്ടില്ല' : 'ജോയിൻ ചെയ്യാൻ പറ്റിയില്ല'); });
}
function useRejoinLink(code, pid, k) {
  return Promise.all([db.ref(ROOMS + code).once('value'), sha(k)]).then(function (res) {
    var v = res[0].val(), p = v && v.players && v.players[pid];
    if (!p || !p.th || p.th !== res[1]) { toast('ഈ ലിങ്ക് ശരിയല്ല / റൂം ഇല്ല'); render(); return; }
    LS.set('zrr_pid', pid); connect(code, pid, p.name, k);
  }).catch(function () { toast('ലിങ്ക് തുറക്കാൻ പറ്റിയില്ല'); render(); });
}
function connect(code, pid, name, tok, spec) {
  disconnect();
  S.solo = false; S.code = code; S.me = pid; S.spokenSeq = null; S.popSeq = null; S.panelKey = ''; S.tryAt = {};
  LS.set('zrr_session', { code: code, pid: pid, name: name, left: false, tok: tok });
  S.ref = db.ref(ROOMS + code);
  var onl = S.ref.child('players/' + pid + '/online'), ref = S.ref, joined = false, th = null, first = false;
  sha(tok).then(function (h) { th = h; tryJoin(); });
  db.ref('.info/serverTimeOffset').on('value', function (s) { S.offset = s.val() || 0; });
  function tryJoin() {
    if (joined || !first || !th || ref !== S.ref) return;
    joined = true;
    dispatch({ type: 'join', pid: pid, name: name, th: th, spec: !!spec });
    db.ref('.info/connected').on('value', function (s) {
      if (s.val() === true && ref === S.ref) { onl.onDisconnect().set(false); dispatch({ type: 'join', pid: pid, name: name, th: th }, true); }
    });
  }
  ref.on('value', function (snap) {
    if (ref !== S.ref) return;
    var v = snap.val();
    if (!v) {
      if (S.tx > 0) return;
      ref.get().then(function (s2) { if (s2.exists() || ref !== S.ref) return; toast('റൂം ഇല്ലാതായി'); LS.del('zrr_session'); disconnect(); S.room = null; render(); }).catch(function () {});
      return;
    }
    if (!first) { first = true; tryJoin(); }
    if (!v.players || !v.players[pid] || !v.players[pid].name) return;
    S.room = E.normalize(v); render();
  }, function (e) { toast('റൂം തുറക്കാൻ പറ്റിയില്ല'); console.warn(e); });
  chatStart(code);
}
function disconnect() {
  if (S.ref) { S.ref.off(); try { S.ref.child('players/' + S.me + '/online').onDisconnect().cancel(); S.ref.child('players/' + S.me + '/online').set(false); } catch (e) {} }
  if (db) { db.ref('.info/connected').off(); db.ref('.info/serverTimeOffset').off(); }
  chatStop(); S.ref = null;
}
function leave() {
  try { speechSynthesis.cancel(); } catch (e) {}
  if (S.solo) { S.room = null; S.solo = false; render(); return; }
  var ses = LS.get('zrr_session'); if (ses) { ses.left = true; LS.set('zrr_session', ses); }
  disconnect(); S.room = null; render();
}
// delete rally rooms (and their chat) older than 24 hours
function cleanupOld() {
  if (!db) return;
  db.ref('.info/serverTimeOffset').once('value').then(function (s) {
    var cutoff = Date.now() + (s.val() || 0) - 864e5 - 120000;
    return db.ref('rallyRooms').orderByChild('createdAt').endAt(cutoff).limitToFirst(25).once('value');
  }).then(function (snap) {
    snap.forEach(function (c) { if (c.key === S.code) return; c.ref.remove().then(function () { return db.ref(CHAT + c.key).remove(); }).catch(function () {}); });
  }).catch(function (e) { console.warn('cleanup', e && e.message); });
}

// ------------------------------------------------------------ chat (free text, locked while a question is live)
function chatStart(code) {
  chatStop();
  S.chat = []; S.chatUnread = 0; S.chatSeen = LS.get('zrr_chatseen_' + code, 0);
  S.chatRef = db.ref(CHAT + code); S.chatQ = S.chatRef.limitToLast(100);
  S.chatQ.on('child_added', function (s) {
    var m = s.val(); if (!m || typeof m.text !== 'string') return;
    m.key = s.key; S.chat.push(m); if (S.chat.length > 100) S.chat.shift();
    if (S.chatOpen) { S.chatSeen = Math.max(S.chatSeen, m.ts || 0); LS.set('zrr_chatseen_' + code, S.chatSeen); }
    else if (m.pid !== S.me && (m.ts || 0) > S.chatSeen) S.chatUnread++;
    renderChat(true);
  }, function () {});
  S.chatQ.on('child_removed', function (s) { S.chat = S.chat.filter(function (m) { return m.key !== s.key; }); renderChat(true); });
}
function chatStop() { if (S.chatQ) S.chatQ.off(); S.chatQ = null; S.chatRef = null; S.chat = []; S.chatUnread = 0; S.chatOpen = false; var b = $('#chat'); if (b) { b.innerHTML = ''; b.hidden = true; } }
function chatSend() {
  var el = $('#chatIn'); if (!el || !S.chatRef || !S.room) return;
  if (chatLocked()) { toast('ചോദ്യം നടക്കുമ്പോൾ ചാറ്റ് പൂട്ടിയിരിക്കുന്നു'); return; }
  var text = el.value.replace(/\s+/g, ' ').trim().slice(0, 300); if (!text) return;
  if (S.chatBusy) return; S.chatBusy = true; setTimeout(function () { S.chatBusy = false; }, 800);
  var p = S.room.players[S.me] || {}, tm = p.role === 'r' ? 'റേസർ' : 'കാണി';
  el.value = ''; updateChatCount();
  var ref = S.chatRef;
  ref.push({ pid: S.me, name: String(p.name || '').slice(0, 24), tm: tm, text: text, ts: firebase.database.ServerValue.TIMESTAMP }).then(function () {
    if (S.chat.length >= 100) { var oldest = S.chat[0].key; ref.orderByKey().endAt(oldest).once('value').then(function (s) { s.forEach(function (c) { if (c.key !== oldest) c.ref.remove(); }); }); }
  }).catch(function () { toast(chatLocked() ? 'ചോദ്യം നടക്കുമ്പോൾ ചാറ്റ് പൂട്ടിയിരിക്കുന്നു' : 'മെസേജ് അയക്കാൻ പറ്റിയില്ല'); });
}
function updateChatCount() { var el = $('#chatIn'), c = $('#chatCount'); if (el && c) c.textContent = el.value.length + '/300'; }
function applyChatLock() {
  var locked = chatLocked(), form = document.querySelector('.chatform'), inp = $('#chatIn'), btn = document.querySelector('.chatform [data-act=chatSend]'), note = $('#chatLockNote');
  if (form) form.classList.toggle('locked', locked);
  if (inp) { inp.disabled = locked; inp.placeholder = locked ? 'ചോദ്യം നടക്കുമ്പോൾ ചാറ്റ് പൂട്ടിയിരിക്കുന്നു' : 'മെസേജ് എഴുതുക…'; }
  if (btn) btn.disabled = locked;
  if (note) note.hidden = !locked;
}
function renderChat(fromData) {
  var box = $('#chat'), btn = $('#chatBtn');
  var inRoom = !!(S.room && !S.solo && S.chatRef);
  if (btn) { btn.hidden = !inRoom; var b = $('#chatBadge'); if (b) { b.textContent = S.chatUnread > 9 ? '9+' : String(S.chatUnread); b.hidden = !S.chatUnread || S.chatOpen; } }
  if (!box) return;
  if (!inRoom || !S.chatOpen) { box.hidden = true; return; }
  box.hidden = false;
  var list = $('#chatList');
  if (!list) {
    box.innerHTML = '<div class="chathead"><b>💬 റൂം ചാറ്റ്</b><span class="small">എല്ലാവർക്കും കാണാം</span><button class="btn sec sm" data-act="chatToggle">അടയ്ക്കുക</button></div>' +
      '<div id="chatList" class="chatlist"></div><div class="chatform"><input id="chatIn" maxlength="300" placeholder="മെസേജ് എഴുതുക…" autocomplete="off"><button class="btn sm" data-act="chatSend">അയക്കുക</button></div>' +
      '<div class="chatlock" id="chatLockNote" hidden>ചോദ്യം നടക്കുമ്പോൾ ചാറ്റ് പൂട്ടിയിരിക്കുന്നു</div><div class="small" id="chatCount" style="text-align:right">0/300</div>';
    list = $('#chatList');
  }
  applyChatLock();
  var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  list.innerHTML = S.chat.length ? S.chat.map(function (m) {
    return '<div class="msg' + (m.pid === S.me ? ' mine' : '') + '"><div class="who">' + esc(m.name) + ' <span>· ' + esc(m.tm || '') + '</span></div><div class="tx">' + esc(m.text) + '</div></div>';
  }).join('') : '<div class="small" style="text-align:center;padding:10px">ഇതുവരെ മെസേജ് ഇല്ല</div>';
  if (atBottom || !fromData) list.scrollTop = list.scrollHeight;
}
function chatToggle() {
  S.chatOpen = !S.chatOpen;
  if (S.chatOpen) { S.chatUnread = 0; S.chat.forEach(function (m) { S.chatSeen = Math.max(S.chatSeen, m.ts || 0); }); LS.set('zrr_chatseen_' + S.code, S.chatSeen); }
  else $('#chat').innerHTML = '';
  renderChat(false);
}

// ------------------------------------------------------------ solo
var BOT_SKILL = [0.82, 0.7, 0.6, 0.75, 0.65, 0.55, 0.8, 0.68, 0.58, 0.72];
function startSolo() {
  var name = myName() || 'ഞാൻ';
  var nb = Math.min(10, Math.max(0, +(($('#soloBots') || {}).value || 3)));
  var set = S.homeSet || firstPlayable();
  if (!E.setPlayable(QS, set)) return toast('കളിക്കാൻ പറ്റുന്ന സെറ്റ് തിരഞ്ഞെടുക്കുക');
  LS.set('zrr_bots', nb);
  var t = Date.now(), me = deviceId();
  var room = E.newRoom({ code: 'SOLO', pid: me, name: name, now: t, solo: true, set: set });
  for (var i = 1; i <= nb; i++) room.players['bot' + i] = { name: E.COLOR_ML[i] + ' കാർ', role: 'r', col: i, bot: true, skill: BOT_SKILL[i - 1], online: true, joinedAt: t + i };
  disconnect(); S.solo = true; S.me = me; S.code = 'SOLO'; S.room = room; S.spokenSeq = null; S.popSeq = null; S.panelKey = ''; S.tryAt = {};
  dispatch({ type: 'start', seed: (Math.random() * 4294967295) >>> 0 });
}
function botAnswers() {
  var r = S.room, g = r.g, out = {};
  g.order.forEach(function (id) {
    var p = r.players[id]; if (!p || !p.bot || g.cars[id].fin) return;
    var x = E.questionFor(r, id, QS), L = g.limit, okk = Math.random() < (p.skill || 0.65);
    if (okk) out[id] = { r: g.r, i: x.q.a, t: L * (0.08 + Math.random() * 0.7) };
    else if (Math.random() < 0.25) out[id] = null;
    else out[id] = { r: g.r, i: (x.q.a + 1 + Math.floor(Math.random() * (x.q.o.length - 1))) % x.q.o.length, t: L * (0.2 + Math.random() * 0.7) };
  });
  return out;
}
function resumeSolo() { var r = LS.get('zrr_solo'); if (!r) return; disconnect(); S.solo = true; S.me = deviceId(); S.code = 'SOLO'; S.room = E.normalize(r); S.panelKey = ''; S.tryAt = {}; render(); }

// ------------------------------------------------------------ answering + auto steps
function answer(i) {
  var r = S.room, g = r && r.g; if (!g || g.phase !== 'q') return;
  var c = g.cars[S.me]; if (!c || c.fin || E.answered(r, S.me)) return;
  var t = Math.max(0, (serverNow() - g.startAt) / 1000);
  S.mySel = { r: g.r, i: i };
  try { speechSynthesis.cancel(); } catch (e) {}
  if (S.solo) { dispatch({ type: 'answer', pid: S.me, i: i, t: t }); return; }
  // own answer slot only (no transaction needed: nobody else writes it)
  S.room.g.ans[S.me] = { r: g.r, i: i, t: t }; render();
  S.ref.child('g/ans/' + S.me).set({ r: g.r, i: i, t: t }).catch(function () { toast('ഉത്തരം അയക്കാൻ പറ്റിയില്ല'); });
}
function tryStep(kind, extra) {
  var r = S.room, g = r.g, key = kind + ':' + g.seq + ':' + g.r, t = Date.now();
  var delay = 0;
  if (!S.solo && r.host !== S.me) { var on = E.racerIds(r).concat(Object.keys(r.players)).indexOf(S.me); delay = 1200 + Math.max(0, on) * 250; }
  if (!S.tryAt[key]) S.tryAt[key] = t + delay;
  if (t < S.tryAt[key]) return;
  S.tryAt[key] = t + 2000;
  var a = { type: kind }; if (extra) for (var k in extra) a[k] = extra[k];
  dispatch(a, true);
}
function tick() {
  var r = S.room; if (!r || r.status !== 'racing' || !r.g) return;
  var g = r.g, now = serverNow();
  if (g.phase === 'count') {
    var left = Math.ceil((g.startAt - now) / 1000), el = $('#countBig'); if (el) el.textContent = left > 0 ? left : 'GO!';
    if (now >= g.startAt) tryStep('go');
  } else if (g.phase === 'q') {
    var rem = (g.endAt - now) / 1000, L = g.limit;
    var n = $('#tnum'); if (n) n.textContent = fmtT(rem);
    var arc = $('#tarc'); if (arc) { var f = Math.max(0, Math.min(1, rem / L)); arc.setAttribute('stroke-dashoffset', String(276.5 * (1 - f))); arc.setAttribute('stroke', f > 0.5 ? '#19b46b' : f > 0.25 ? '#f5b301' : '#e5484d'); }
    var gain = $('#gain'); if (gain) { var el2 = L - rem, st = E.stepsFor(Math.max(0, el2), L); gain.textContent = st > 0 ? 'ഇപ്പോൾ ശരിയായാൽ +' + st + ' ചുവട്' : 'സമയം കഴിഞ്ഞു'; }
    if (E.allAnswered(r) || now >= g.endAt + E.GRACE_MS) tryStep('resolve', S.solo ? { bots: botAnswers() } : null);
  } else if (g.phase === 'rev') {
    if (now >= g.revEnd) tryStep('next');
  }
}

// ------------------------------------------------------------ race view (3D / lite)
function wantMode() { var m = LS.get('zrr_mode', null); if (m) return m; return window.RaceView && RaceView.webglOk() ? '3d' : 'lite'; }
var threeP = null;
function loadThree() {
  if (window.THREE) return Promise.resolve();
  if (!threeP) threeP = new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = 'vendor/three.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  return threeP;
}
function ensureView() {
  var host = $('#track'); if (!host) return;
  var mode = wantMode();
  if (S.view && S.viewMode === mode && host.contains(document.querySelector('#track .race-canvas'))) return;
  if (S.view) { S.view.destroy(); S.view = null; }
  S.viewMode = mode;
  var mk = function (m) {
    S.view = RaceView.create(host, m, {
      onFail: function () { toast('ഈ ഫോണിൽ 3D ഇല്ല. ലൈറ്റ് മോഡ് ഉപയോഗിക്കുന്നു'); LS.set('zrr_mode', 'lite'); S.viewMode = 'lite'; },
      onLowFps: function (f) { if (LS.get('zrr_fpsask', 0)) return; lowFpsSheet(f); }
    });
    S.viewMode = S.view.mode; pushView(); renderViewBtns();
  };
  if (mode === '3d') loadThree().then(function () { if (S.viewMode === '3d' && !S.view) mk('3d'); }).catch(function () { LS.set('zrr_mode', 'lite'); mk('lite'); toast('3D ലോഡ് ആയില്ല. ലൈറ്റ് മോഡ്'); });
  else mk('lite');
}
function lowFpsSheet(f) {
  var sh = $('#sheet');
  sh.innerHTML = '<div class="sheetin"><h3>⚡ ഈ ഫോണിൽ 3D പതുക്കെയാണ്</h3><p class="mut">ഇപ്പോൾ ' + Math.round(f) + ' FPS മാത്രം. ലൈറ്റ് മോഡിൽ (2D) കളി വേഗത്തിലും സുഗമമായും ഓടും. നിയമങ്ങൾ എല്ലാം ഒന്നുതന്നെ.</p>' +
    '<button class="btn" data-act="toLite">ലൈറ്റ് മോഡിലേക്ക് മാറുക</button><button class="btn sec" data-act="keep3d">3D തന്നെ മതി</button></div>';
  sh.hidden = false;
}
function setMode(m) { LS.set('zrr_mode', m); if (S.view) { S.view.destroy(); S.view = null; } S.viewMode = null; render(); }
function pushView() {
  if (!S.view || !S.room || !S.room.g) return;
  var r = S.room, g = r.g, n = g.order.length, isR = !!g.cars[S.me];
  S.view.update({
    seq: g.seq, phase: g.phase, res: g.phase === 'rev' || g.phase === 'done' ? g.res : {},
    focus: isR ? S.me : E.ranking(r)[0],
    cars: g.order.map(function (id) { var c = g.cars[id], p = r.players[id] || {}; return { id: id, name: p.name || '—', col: col(p.col), lane: c.lane, n: n, d: c.d, pit: c.pit, fin: c.fin, me: id === S.me }; })
  });
}
function renderViewBtns() {
  var b = $('#viewBtns'); if (!b) return;
  var m = S.viewMode, cm = S.view && S.view.cam ? S.view.cam() : 'follow';
  b.innerHTML = (m === '3d' ? '<button class="vbtn" data-act="cam">' + (cm === 'follow' ? '🗺️ മുഴുവൻ ട്രാക്ക്' : '🎥 എന്റെ കാർ') + '</button>' : '') +
    '<button class="vbtn" data-act="mode">' + (m === '3d' ? '⚡ ലൈറ്റ് മോഡ്' : '🎮 3D മോഡ്') + '</button>';
}

// ------------------------------------------------------------ render
function show(id) { ['home', 'lobby', 'game', 'result'].forEach(function (x) { $('#' + x).hidden = x !== id; }); }
function render() {
  document.body.classList.toggle('inroom', !!S.room);
  renderTop();
  var r = S.room;
  if (!r) { if (S.view) { S.view.destroy(); S.view = null; } show('home'); renderHome(); renderChat(); return; }
  if (r.status === 'lobby') { if (S.view) { S.view.destroy(); S.view = null; } show('lobby'); renderLobby(); }
  else if (r.status === 'racing') { show('game'); renderGame(); }
  else { show('result'); renderResult(); }
  renderChat();
}
function renderTop() {
  var r = S.room, h = '';
  h += '<button class="chip" data-act="voice" title="ശബ്ദം">' + (voiceOn() ? '🔊' : '🔇') + '</button>';
  if (r && !S.solo) h += '<span class="chip gold">' + esc(r.code) + '</span><button class="chip" id="chatBtn" data-act="chatToggle">💬<b id="chatBadge" class="badge" hidden>0</b></button>';
  if (r && S.solo) h += '<span class="chip green">സോളോ</span>';
  $('#topRight').innerHTML = h;
}
function setPicker(selected, canPick, act) {
  return E.listSets(QS).map(function (grp) {
    var h = '<div class="setgrp"><div class="setgrp-h">' + esc(grp.type.ml) + ' <span class="small">· ' + limitTxt(grp.type.limit) + '</span></div>';
    if (!grp.sets.some(function (s) { return s.ok; })) return h + '<div class="soon">ഉടൻ വരുന്നു</div></div>';
    return h + grp.sets.filter(function (s) { return s.ok; }).map(function (s) {
      return '<button class="setbtn' + (s.name === selected ? ' sel' : '') + '"' + (canPick ? ' data-act="' + act + '" data-set="' + esc(s.name) + '"' : ' disabled') + '>' + esc(s.name) + '</button>';
    }).join('') + '</div>';
  }).join('');
}
function rulesHtml() {
  var L = 10, b = E.bands(L);
  return '<details class="card rules"><summary><b>🏁 കളിക്കുന്ന വിധം</b></summary>' +
    '<ul><li>റേസ് = 3 ലാപ്പ്, ഓരോ ലാപ്പിലും 10 ചെക്ക്പോയിന്റ് (ആകെ 30 ചോദ്യം). ഓരോ റേസിലും ചോദ്യങ്ങളും ഓപ്ഷനുകളും പുതിയ ക്രമത്തിൽ.</li>' +
    '<li>ഓരോ ചെക്ക്പോയിന്റിലും എല്ലാവർക്കും ഒരേ ചോദ്യം ഒരേ സമയം.</li>' +
    '<li>വേഗത്തിൽ ശരിയുത്തരം = കാർ കൂടുതൽ മുന്നോട്ട്: ' + b.map(function (x) { return x.to + ' സെ. വരെ +' + x.steps; }).join(', ') + ' (ഓപ്ഷൻ സെറ്റ്, 10 സെക്കൻഡ്).</li>' +
    '<li>തെറ്റിയാലോ സമയം കഴിഞ്ഞാലോ 💥 ബ്രേക്ക്ഡൗൺ. കാർ 🔧 പിറ്റ് സ്റ്റോപ്പിൽ നിൽക്കും. അടുത്ത തവണ ഒരു റിപ്പയർ ചോദ്യം, ശരിയായാൽ കാർ തിരികെ റേസിൽ.</li>' +
    '<li>🔥 തുടർച്ചയായി 3 ശരിയുത്തരം = നൈട്രോ ബൂസ്റ്റ് (+3 ചുവട്, ബാറ്ററിയിൽ നിന്ന് 12%).</li>' +
    '<li>🔋 ബാറ്ററി: ഓരോ ഓട്ടത്തിനും 4% പോകും, ശരിയുത്തരത്തിന് +6%, ബാറ്ററി/ചാർജിങ്/പവർ ചോദ്യം ശരിയായാൽ +14% കൂടി. 20%-ൽ താഴെയായാൽ കാറിന്റെ വേഗം കുറയും. പിറ്റ് സ്റ്റോപ്പിൽ 60% വരെ ചാർജ് ആകും.</li>' +
    '<li>ആദ്യം 150 ചുവട് (3 ലാപ്പ്) പൂർത്തിയാക്കുന്നവർ ജയിക്കും. 30 ചോദ്യം കഴിഞ്ഞാൽ കൂടുതൽ ദൂരം പോയവർ മുന്നിൽ.</li>' +
    '<li>ഒരു റൂമിൽ 2 മുതൽ 11 വരെ റേസർമാർ. ബാക്കിയുള്ളവർക്ക് കാണിയായി കാണാം.</li></ul></details>';
}
function academyBtn() { return '<a class="btn gold academy" href="' + ACADEMY + '" target="_blank" rel="noopener">🎓 Zaman Smartphone Repair Academy-യിൽ ചേരൂ</a>'; }
function renderHome() {
  var ses = LS.get('zrr_session'), solo = LS.get('zrr_solo'), name = LS.get('zrr_name', '');
  var pre = (new URLSearchParams(location.search)).get('room') || '';
  if (!S.homeSet || !E.setPlayable(QS, S.homeSet)) S.homeSet = firstPlayable();
  var nb = LS.get('zrr_bots', 3), mode = wantMode();
  var h = '<div class="hero"><div class="heroCar">' + carSvg('#e53935', 120) + '</div><h1>ZAMAN <span>REPAIR RALLY</span></h1><p>സ്മാർട്ട്ഫോൺ ടെക്നോളജി ക്വിസ് കാർ റേസ് 🏁</p></div>';
  if (ses && ses.code && db) h += '<div class="card rejoin"><b>🔁 നിങ്ങളുടെ റൂം: ' + esc(ses.code) + '</b><button class="btn" data-act="rejoin">തിരികെ റേസിലേക്ക്</button><button class="btn sec sm" data-act="forget" style="margin-top:8px">മറക്കുക</button></div>';
  if (solo && solo.status === 'racing') h += '<div class="card rejoin"><b>🔁 സോളോ റേസ് പാതിയിലാണ്</b><button class="btn" data-act="resumeSolo">സോളോ തുടരുക</button></div>';
  h += '<div class="card"><label class="lbl">നിങ്ങളുടെ പേര്</label><input id="nameIn" maxlength="20" placeholder="ഉദാ: അൻവർ" value="' + esc(name) + '">' +
    '<button class="btn" data-act="create">🏁 പുതിയ റേസ് റൂം ഉണ്ടാക്കുക</button>' +
    '<div class="or">അല്ലെങ്കിൽ</div><label class="lbl">റൂം കോഡ്</label><div class="row"><input id="codeIn" maxlength="6" placeholder="ABC123" value="' + esc(pre) + '" style="text-transform:uppercase"><button class="btn blue" data-act="join" style="margin:0;flex:none;width:auto">ജോയിൻ</button></div>' +
    '<button class="btn sec sm" data-act="joinSpec" style="margin-top:8px">👀 കാണിയായി മാത്രം ജോയിൻ</button></div>';
  h += '<div class="card"><h3>🎮 സോളോ റേസ് (ഒറ്റയ്ക്ക് പരിശീലനം)</h3><p class="mut">എല്ലാ നിയമങ്ങളും ഉണ്ട്. കമ്പ്യൂട്ടർ കാറുകളോട് മത്സരിക്കാം.</p>' +
    '<label class="lbl">കമ്പ്യൂട്ടർ കാറുകൾ (0–10)</label><select id="soloBots">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) { return '<option value="' + i + '"' + (i === nb ? ' selected' : '') + '>' + i + (i === 10 ? ' (ആകെ 11 കാർ)' : '') + '</option>'; }).join('') + '</select>' +
    '<label class="lbl">ചോദ്യ സെറ്റ്</label>' + setPicker(S.homeSet, true, 'homeSet') +
    '<button class="btn gold" data-act="solo">സോളോ റേസ് തുടങ്ങുക</button></div>';
  h += '<div class="card"><h3>⚙️ ക്രമീകരണം</h3><div class="row"><button class="btn ' + (mode === '3d' ? '' : 'sec') + ' sm" data-act="setMode" data-m="3d">🎮 3D</button><button class="btn ' + (mode === 'lite' ? '' : 'sec') + ' sm" data-act="setMode" data-m="lite">⚡ ലൈറ്റ് മോഡ് (2D)</button></div>' +
    '<p class="small" style="margin-top:6px">പഴയ / വിലകുറഞ്ഞ ഫോണിൽ ലൈറ്റ് മോഡ് നല്ലത്.</p>' +
    '<div class="row" style="margin-top:8px"><button class="btn ' + (voiceOn() ? '' : 'sec') + ' sm" data-act="voice">' + (voiceOn() ? '🔊 ചോദ്യം വായിക്കും' : '🔇 ശബ്ദം ഓഫ്') + '</button></div>' +
    (('speechSynthesis' in window) && !mlVoice() ? '<p class="small">ഈ ഫോണിൽ മലയാളം ശബ്ദം കണ്ടില്ല. ഉണ്ടെങ്കിൽ മാത്രം വായിക്കും.</p>' : '') + '</div>';
  h += rulesHtml() + academyBtn() + '<p class="small foot">© Zaman Enterprises, Valanchery · ചോദ്യങ്ങൾ: Zaman Cricket Quiz</p>';
  $('#home').innerHTML = h;
}
function renderLobby() {
  var r = S.room, me = r.players[S.me] || {}, admin = E.isAdmin(r, S.me), racers = E.racerIds(r);
  var specs = Object.keys(r.players).filter(function (id) { return r.players[id].role !== 'r'; });
  var link = baseUrl() + '?room=' + r.code;
  var h = '<div class="card center"><div class="mut">റൂം കോഡ്</div><div class="code">' + esc(r.code) + '</div>' +
    '<div class="row"><button class="btn sec sm" data-act="copyLink">🔗 ലിങ്ക് കോപ്പി</button><a class="btn sec sm" href="https://wa.me/?text=' + encodeURIComponent('Zaman Repair Rally-യിൽ എന്നോടൊപ്പം റേസ് ചെയ്യൂ! റൂം കോഡ്: ' + r.code + ' ' + link) + '" target="_blank" rel="noopener">WhatsApp</a></div>' +
    '<button class="btn sec sm" data-act="myLink" style="margin-top:8px">🔑 എന്റെ റീജോയിൻ ലിങ്ക്</button></div>';
  h += '<div class="card"><h3>🏎️ റേസർമാർ (' + racers.length + '/' + E.MAX_RACERS + ')</h3>' + racers.map(function (id) {
    var p = r.players[id];
    return '<div class="prow">' + carSvg(col(p.col), 38) + '<span class="pn">' + esc(p.name) + (id === S.me ? ' (ഞാൻ)' : '') + '</span>' + (id === r.host ? '<span class="tag gold">ഹോസ്റ്റ്</span>' : '') + (p.online ? '' : '<span class="tag">ഓഫ്‌ലൈൻ</span>') + '</div>';
  }).join('') + (racers.length < 2 ? '<p class="mut">കുറഞ്ഞത് 2 റേസർമാർ വേണം. കോഡ് / ലിങ്ക് കൂട്ടുകാർക്ക് അയക്കൂ.</p>' : '') + '</div>';
  if (specs.length) h += '<div class="card"><h3>👀 കാണികൾ (' + specs.length + ')</h3>' + specs.map(function (id) { var p = r.players[id]; return '<div class="prow"><span class="pn">' + esc(p.name) + (id === S.me ? ' (ഞാൻ)' : '') + '</span>' + (p.online ? '' : '<span class="tag">ഓഫ്‌ലൈൻ</span>') + '</div>'; }).join('') + '</div>';
  h += '<div class="card">' + (me.role === 'r' ? '<button class="btn sec" data-act="role" data-r="s">👀 കാണിയായി മാറുക</button>' : (racers.length < E.MAX_RACERS ? '<button class="btn" data-act="role" data-r="r">🏎️ റേസറായി ചേരുക</button>' : '<p class="mut">11 റേസർമാർ ആയി. നിങ്ങൾ കാണിയാണ്.</p>')) + '</div>';
  h += '<div class="card"><h3>ചോദ്യ സെറ്റ്</h3>' + setPicker(r.set, admin, 'roomSet') + '</div>';
  if (admin) h += '<button class="btn gold" data-act="start"' + (racers.length < 2 ? ' disabled' : '') + '>🏁 റേസ് തുടങ്ങുക</button>';
  else h += '<div class="card wait">⏳ ഹോസ്റ്റ് റേസ് തുടങ്ങാൻ കാത്തിരിക്കുന്നു…</div>';
  h += rulesHtml() + '<button class="btn sec" data-act="leave">റൂം വിടുക</button>';
  $('#lobby').innerHTML = h;
}
function myCar() { var g = S.room.g; return g.cars[S.me] || null; }
function lapCp(g) { var r = Math.min(g.r, E.ROUNDS - 1); return { lap: Math.floor(r / E.CPS) + 1, cp: r % E.CPS + 1 }; }
function renderGame() {
  var r = S.room, g = r.g;
  if (!$('#track')) {
    $('#game').innerHTML = '<div class="trackwrap"><div id="track"></div><div id="hud"></div><div id="viewBtns" class="viewbtns"></div><div id="countWrap" class="countwrap" hidden><div id="countBig">3</div></div></div><div id="stand" class="stand"></div><div id="panel"></div>';
  }
  var tw = document.querySelector('.trackwrap'); if (tw) tw.classList.toggle('compact', g.phase === 'q');
  ensureView(); pushView(); renderViewBtns(); renderHud(); renderStand(); renderPanel();
  $('#countWrap').hidden = g.phase !== 'count';
  // read the question aloud once per round
  if (g.phase === 'q' && S.spokenSeq !== g.seq) {
    S.spokenSeq = g.seq; try { window.scrollTo(0, 0); } catch (e) {}
    var x = E.questionFor(r, g.cars[S.me] && !g.cars[S.me].fin ? S.me : g.order[0], QS);
    if (x) speakQ(x.q);
  }
  if (g.phase === 'rev' && S.popSeq !== g.seq) { S.popSeq = g.seq; resultPop(); }
}
function renderHud() {
  var r = S.room, g = r.g, c = myCar(), lc = lapCp(g), rank = E.ranking(r), pos = rank.indexOf(S.me) + 1;
  var h = '<div class="hud-l"><b>ലാപ്പ് ' + lc.lap + '/' + E.LAPS + '</b><span>ചെക്ക്പോയിന്റ് ' + lc.cp + '/' + E.CPS + '</span></div>';
  if (c) {
    var bcls = c.b < E.BAT_LOW ? 'low' : c.b < 50 ? 'mid' : '';
    h += '<div class="hud-r"><b>' + (c.fin ? '🏁 ' : '') + pos + '<small>/' + g.order.length + '</small></b><span>സ്ഥാനം</span></div>';
    h += '<div class="hud-b"><div class="bat ' + bcls + '"><i style="width:' + Math.max(0, Math.min(100, c.b)) + '%"></i><span>🔋 ബാറ്ററി ' + Math.round(c.b) + '%</span></div>' +
      '<div class="nitrob" title="നൈട്രോ">' + [0, 1, 2].map(function (k) { return '<i class="' + (k < (c.st % 3) ? 'on' : '') + '"></i>'; }).join('') + '<span>🔥' + (c.nit || 0) + '</span></div></div>';
  } else h += '<div class="hud-r"><b>👀</b><span>കാണി</span></div>';
  $('#hud').innerHTML = h;
}
function renderStand() {
  var r = S.room, g = r.g, rank = E.ranking(r);
  $('#stand').innerHTML = rank.map(function (id, i) {
    var c = g.cars[id], p = r.players[id] || {}, lap = Math.min(E.LAPS, Math.floor(c.d / E.LAP_STEPS) + 1);
    var ic = c.fin ? '🏁' : c.pit ? '🔧' : (g.phase === 'rev' && g.res[id] && g.res[id].n) ? '🔥' : '';
    var ans = g.phase === 'q' && !c.fin && E.answered(r, id) ? ' ✓' : '';
    return '<span class="sc' + (id === S.me ? ' me' : '') + '"><b>' + (i + 1) + '</b><i style="background:' + col(p.col) + '"></i>' + esc(p.name) + ' <small>' + (c.fin ? '' : 'L' + lap + ' · ') + c.d + ans + '</small>' + ic + '</span>';
  }).join('');
}
function ringHtml(L, rem) {
  return '<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" stroke="#26355a" stroke-width="9" fill="none"/><circle id="tarc" cx="50" cy="50" r="44" stroke="#19b46b" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><div class="num"><span id="tnum">' + fmtT(rem) + '</span><small>' + (L >= 60 ? (L / 60) + ' മി.' : L + ' സെ.') + '</small></div></div>';
}
function qCard(x, mode, sel, revealA) {
  var q = x.q || { q: '?', o: [] };
  var h = '<div class="qtext">' + esc(q.q) + '</div>';
  h += (q.o || []).map(function (o, i) {
    var cls = 'opt'; if (sel === i) cls += ' sel'; if (revealA != null && i === revealA) cls += ' good'; else if (revealA != null && sel === i) cls += ' bad';
    return '<button class="' + cls + '"' + (mode === 'answer' ? ' data-act="ans" data-i="' + i + '"' : ' disabled') + '><span class="k">' + (i + 1) + '</span><span>' + esc(o) + '</span></button>';
  }).join('');
  return h;
}
function renderPanel() {
  var r = S.room, g = r.g, c = myCar(), now = serverNow(), h = '', key;
  if (g.phase === 'count') { key = 'count' + g.seq; h = '<div class="card wait center">🚦 റേസ് തുടങ്ങുന്നു… എല്ലാ കാറുകളും സ്റ്റാർട്ടിങ് ഗ്രിഡിൽ</div>'; }
  else if (g.phase === 'q') {
    var mine = c && !c.fin, done = mine && E.answered(r, S.me), x = E.questionFor(r, mine ? S.me : g.order.filter(function (id) { return !g.cars[id].pit; })[0] || g.order[0], QS);
    var waitN = E.waitIds(r).length, ansN = E.waitIds(r).filter(function (id) { return E.answered(r, id); }).length;
    key = 'q' + g.seq + (done ? 'd' : '') + (mine ? 'm' : '');
    var an = $('#ansN'); if (an) an.textContent = ansN + '/' + waitN;
    if (S.panelKey === key) return;
    var tag = (mine && c.pit) ? '<div class="tagline pit">🔧 പിറ്റ് സ്റ്റോപ്പ്: റിപ്പയർ ചോദ്യം. ശരിയായാൽ കാർ തിരികെ റേസിൽ</div>' : '<div class="tagline">🏁 ലാപ്പ് ' + lapCp(g).lap + ' · ചെക്ക്പോയിന്റ് ' + lapCp(g).cp + '</div>';
    h = '<div class="card qcard">' + tag + '<div class="qhead">' + ringHtml(g.limit, (g.endAt - now) / 1000) + '<div class="qmeta"><div id="gain" class="gain"></div><button class="btn sec sm" data-act="speakQ">🔊 വീണ്ടും കേൾക്കുക</button>' + (S.solo ? '' : '<div class="small">ഉത്തരം നൽകിയവർ: <b id="ansN">' + ansN + '/' + waitN + '</b></div>') + '</div></div>';
    if (mine && !done) h += qCard(x, 'answer');
    else if (mine && done) h += qCard(x, 'view', (g.ans[S.me] || {}).i) + '<div class="wait">✅ ഉത്തരം നൽകി. മറ്റുള്ളവരെ കാത്തിരിക്കുന്നു…</div>';
    else if (c && c.fin) h += '<div class="wait">🏁 നിങ്ങൾ ഫിനിഷ് ചെയ്തു (സ്ഥാനം ' + c.fin + '). മറ്റുള്ളവർ ഓടുന്നു…</div>' + qCard(x, 'view');
    else h += '<div class="wait">👀 കാണി: ചോദ്യം കാണാം, ഉത്തരം നൽകാൻ പറ്റില്ല</div>' + qCard(x, 'view');
    h += '</div>';
  } else if (g.phase === 'rev') {
    key = 'rev' + g.seq; if (S.panelKey === key) return;
    var res = g.res[S.me];
    h = '<div class="card">';
    if (res) {
      var xq = E.qOf(QS, res.s + '|' + res.i, res.pm).q || { q: '', o: [] }; // same option order the player saw
      h += '<div class="resline ' + res.k + '">' + resText(res) + '</div>' + qCard({ q: xq }, 'view', res.c >= 0 ? res.c : null, xq.a);
    } else h += '<div class="wait">ഈ ചെക്ക്പോയിന്റിലെ ഫലം</div>';
    h += '<div class="rlist">' + g.order.filter(function (id) { return g.res[id]; }).map(function (id) { var x2 = g.res[id], p = r.players[id] || {}; return '<div class="rrow"><i style="background:' + col(p.col) + '"></i><span>' + esc(p.name) + '</span><b class="' + x2.k + '">' + shortRes(x2) + '</b></div>'; }).join('') + '</div></div>';
  } else { key = 'x'; h = ''; }
  if (S.panelKey === key) return;
  S.panelKey = key;
  h += '<button class="btn sec sm leavebtn" data-act="leave">' + (S.solo ? 'സോളോ നിർത്തുക' : 'റൂം വിടുക') + '</button>';
  $('#panel').innerHTML = h;
  tick();
}
function resText(x) {
  if (x.k === 'ok') return (x.n ? '🔥 നൈട്രോ ബൂസ്റ്റ്! ' : '✅ ശരി! ') + '+' + x.d + ' ചുവട്' + (x.lo ? ' (ബാറ്ററി കുറവ്, വേഗം കുറഞ്ഞു)' : '') + (x.nn ? ' · നൈട്രോയ്ക്ക് ബാറ്ററി പോരാ' : '') + (x.fin ? ' · 🏁 ഫിനിഷ്! സ്ഥാനം ' + x.fin : '');
  if (x.k === 'wrong') return '💥 തെറ്റ്! ബ്രേക്ക്ഡൗൺ. കാർ പിറ്റ് സ്റ്റോപ്പിലേക്ക്';
  if (x.k === 'to') return '⏰ സമയം കഴിഞ്ഞു! ബ്രേക്ക്ഡൗൺ. കാർ പിറ്റ് സ്റ്റോപ്പിലേക്ക്';
  if (x.k === 'fix') return '🔧 റിപ്പയർ ശരിയായി! ബാറ്ററി ചാർജ് ചെയ്തു, കാർ തിരികെ റേസിൽ';
  if (x.k === 'pitfail') return '🔧 റിപ്പയർ ഉത്തരം തെറ്റി. കാർ ഇനിയും പിറ്റിൽ';
  return '';
}
function shortRes(x) { return x.k === 'ok' ? (x.n ? '🔥 +' : '+') + x.d + (x.fin ? ' 🏁' + x.fin : '') : x.k === 'wrong' ? '💥 തെറ്റ്' : x.k === 'to' ? '⏰ സമയം' : x.k === 'fix' ? '🔧 ശരിയായി' : '🔧 പിറ്റിൽ'; }
function resultPop() {
  var x = S.room.g.res[S.me]; if (!x) return;
  var cls = x.k === 'ok' ? (x.n ? 'nitro' : 'good') : x.k === 'fix' ? 'good' : 'bad';
  var big = x.k === 'ok' ? (x.n ? '🔥 NITRO +' + x.d : '+' + x.d) : x.k === 'fix' ? '🔧 റിപ്പയർ OK' : x.k === 'pitfail' ? '🔧 ഇനിയും പിറ്റിൽ' : '💥 ബ്രേക്ക്ഡൗൺ';
  var p = $('#pop'); p.className = 'pop ' + cls; p.innerHTML = '<div class="in"><div class="big">' + big + '</div><div class="sub">' + esc(resText(x)) + '</div></div>'; p.hidden = false;
  clearTimeout(resultPop.t); resultPop.t = setTimeout(function () { p.hidden = true; }, 1500);
}
function renderResult() {
  var r = S.room, g = r.g, rank = g.rank || E.ranking(r), admin = E.isAdmin(r, S.me);
  if (S.view) { S.view.destroy(); S.view = null; } var tw = $('#track'); if (tw) $('#game').innerHTML = '';
  var pod = [1, 0, 2].map(function (k) {
    var id = rank[k]; if (!id) return '<div class="pod p' + (k + 1) + ' empty"></div>';
    var p = r.players[id] || {}, c = g.cars[id];
    return '<div class="pod p' + (k + 1) + '"><div class="pcar">' + carSvg(col(p.col), 70) + '</div><div class="pname">' + esc(p.name) + '</div><div class="pblock"><b>' + (k + 1) + '</b><small>' + (c.fin ? '🏁 ഫിനിഷ്' : c.d + ' ചുവട്') + '</small></div></div>';
  }).join('');
  var myPos = rank.indexOf(S.me) + 1;
  var h = '<div class="card center"><h2>🏆 റേസ് കഴിഞ്ഞു!</h2>' + (myPos ? '<p class="mut">നിങ്ങളുടെ സ്ഥാനം: <b>' + myPos + '/' + rank.length + '</b></p>' : '') + '<div class="podium">' + pod + '</div><div class="flagline">🏁🏁🏁</div></div>';
  h += '<div class="card"><h3>മുഴുവൻ ഫലം</h3><table class="tbl"><tr><th>#</th><th>കാർ</th><th>ദൂരം</th><th>ശരി</th><th>🔥</th><th>💥</th></tr>' + rank.map(function (id, i) {
    var p = r.players[id] || {}, c = g.cars[id];
    return '<tr' + (id === S.me ? ' class="me"' : '') + '><td>' + (i + 1) + '</td><td><i class="dot" style="background:' + col(p.col) + '"></i>' + esc(p.name) + '</td><td>' + (c.fin ? '🏁' : c.d) + '</td><td>' + c.ok + '</td><td>' + c.nit + '</td><td>' + c.brk + '</td></tr>';
  }).join('') + '</table></div>';
  h += reviewHtml(r);
  h += academyBtn();
  if (S.solo) h += '<button class="btn" data-act="solo">🔁 വീണ്ടും സോളോ റേസ് (പുതിയ ചോദ്യ ക്രമം)</button>';
  else if (admin) h += '<button class="btn" data-act="reset">🔁 വീണ്ടും റേസ് (ലോബിയിലേക്ക്)</button>';
  else h += '<div class="card wait">ഹോസ്റ്റ് പുതിയ റേസ് തുടങ്ങാൻ കാത്തിരിക്കുക</div>';
  h += '<button class="btn sec" data-act="leave">ഹോമിലേക്ക്</button>';
  $('#result').innerHTML = h;
}
function reviewHtml(r) {
  var g = r.g, list = (g.miss && g.miss[S.me]) || [];
  if (!g.cars[S.me]) return '';
  if (!list.length) return '<div class="card"><h3>📘 തെറ്റിയ ചോദ്യങ്ങൾ</h3><p class="mut">ഒരു ചോദ്യവും തെറ്റിയില്ല. അടിപൊളി! 👏</p></div>';
  return '<div class="card"><h3>📘 തെറ്റിയ ചോദ്യങ്ങൾ (' + list.length + ')</h3>' + list.map(function (m) {
    var q = E.qOf(QS, m.s + '|' + m.i, m.pm).q || { o: [] };
    return '<div class="rev"><div class="rq">' + (m.p ? '🔧 ' : '') + esc(q.q) + '</div><div class="ra bad">നിങ്ങൾ: ' + (m.c >= 0 ? esc(q.o[m.c]) : 'സമയം കഴിഞ്ഞു') + '</div><div class="ra good">ശരിയുത്തരം: ' + esc(q.o[q.a]) + '</div></div>';
  }).join('') + '</div>';
}

// ------------------------------------------------------------ events
document.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-act]'); if (!b) return;
  var a = b.dataset.act;
  if (a === 'create') createRoom();
  else if (a === 'join') joinRoom();
  else if (a === 'joinSpec') joinRoom(null, true);
  else if (a === 'solo') startSolo();
  else if (a === 'resumeSolo') resumeSolo();
  else if (a === 'rejoin') { var s = LS.get('zrr_session'); if (s) connect(s.code, s.pid, s.name, s.tok); }
  else if (a === 'forget') { LS.del('zrr_session'); render(); }
  else if (a === 'leave') { if (S.room && S.room.status === 'racing' && !confirm('റേസിൽ നിന്ന് പുറത്തുപോകണോ?')) return; leave(); }
  else if (a === 'homeSet') { S.homeSet = b.dataset.set; renderHome(); }
  else if (a === 'roomSet') dispatch({ type: 'setSet', set: b.dataset.set });
  else if (a === 'role') dispatch({ type: 'role', role: b.dataset.r });
  else if (a === 'start') dispatch({ type: 'start', seed: (Math.random() * 4294967295) >>> 0 });
  else if (a === 'reset') dispatch({ type: 'reset' });
  else if (a === 'ans') answer(+b.dataset.i);
  else if (a === 'speakQ') { var g = S.room.g; var x = E.questionFor(S.room, g.cars[S.me] && !g.cars[S.me].fin ? S.me : g.order[0], QS); var was = voiceOn(); if (!was) LS.set('zrr_voice', true); speakQ(x.q); if (!was) LS.set('zrr_voice', false); }
  else if (a === 'voice') { LS.set('zrr_voice', !voiceOn()); if (!voiceOn()) try { speechSynthesis.cancel(); } catch (e) {} toast(voiceOn() ? 'ചോദ്യം ഉറക്കെ വായിക്കും' : 'ശബ്ദം ഓഫ്', true); render(); }
  else if (a === 'setMode') { LS.set('zrr_mode', b.dataset.m); renderHome(); }
  else if (a === 'mode') setMode(S.viewMode === '3d' ? 'lite' : '3d');
  else if (a === 'cam') { if (S.view) S.view.setCam(S.view.cam() === 'follow' ? 'overview' : 'follow'); renderViewBtns(); }
  else if (a === 'toLite') { $('#sheet').hidden = true; LS.set('zrr_fpsask', 1); setMode('lite'); }
  else if (a === 'keep3d') { $('#sheet').hidden = true; LS.set('zrr_fpsask', 1); }
  else if (a === 'chatToggle') chatToggle();
  else if (a === 'chatSend') chatSend();
  else if (a === 'copyLink') copy(baseUrl() + '?room=' + S.room.code);
  else if (a === 'myLink') { var u = rejoinUrl(); if (u) copy(u, 'നിങ്ങളുടെ സ്വന്തം റീജോയിൻ ലിങ്ക് കോപ്പി ചെയ്തു. ആർക്കും അയക്കരുത്'); }
});
document.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target && ev.target.id === 'chatIn') chatSend(); });
document.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'chatIn') updateChatCount(); });
document.getElementById('sheet').addEventListener('click', function (ev) { if (ev.target.id === 'sheet') ev.target.hidden = true; });
function copy(t, msg) {
  var done = function () { toast(msg || 'ലിങ്ക് കോപ്പി ചെയ്തു', true); };
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { prompt('കോപ്പി ചെയ്യുക', t); }); else prompt('കോപ്പി ചെയ്യുക', t);
}

// ------------------------------------------------------------ boot
function boot() {
  try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () { if (!S.room) renderHome(); }; } catch (e) {}
  S.tick = setInterval(tick, 200);
  var qp = new URLSearchParams(location.search);
  render();
  if (db) {
    var rr = qp.get('r'), pp = qp.get('p'), kk = qp.get('k');
    if (rr && pp && kk) { history.replaceState(null, '', location.pathname); useRejoinLink(rr.toUpperCase(), pp, kk); }
    else { var ses = LS.get('zrr_session'); if (ses && ses.code && !ses.left) connect(ses.code, ses.pid, ses.name, ses.tok); }
    setTimeout(cleanupOld, 4000);
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
boot();
})();
