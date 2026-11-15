/* Zaman Repair Rally v2 - UI, rooms (Firebase RTDB: rallyRooms/, rallyChat/), Solo, calm race bar + sounds.
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
var S = { room: null, me: null, solo: false, ref: null, code: null, offset: 0, chat: [], chatUnread: 0, chatOpen: false, wasReading: null, spokenSeq: null, popSeq: null, panelKey: '', tick: null, tryAt: {}, homeSet: null, mySel: null };
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
// side view, FRONT ON THE RIGHT (direction of travel → finish): long hood + slanted windshield + headlight at the right, spoiler + red tail light at the left
function carSvg(c, w) { return '<svg class="carsvg" viewBox="0 0 64 30" width="' + (w || 40) + '" aria-hidden="true">' +
  '<rect x="4" y="8" width="2.4" height="5.5" fill="' + c + '" stroke="rgba(0,0,0,.55)" stroke-width=".6"/><path d="M0.5 6 H11 V9 H0.5Z" fill="' + c + '" stroke="rgba(0,0,0,.55)" stroke-width=".8"/>' +
  '<path d="M3 22 V15 Q3 13 5 13 L14 12 L20 5 Q21 4 23 4 L34 4 Q36 4 38 6 L44 12 L57 13 Q61 14 61 18 V22 Q61 24 59 24 H5 Q3 24 3 22Z" fill="' + c + '" stroke="rgba(0,0,0,.55)" stroke-width="1"/>' +
  '<path d="M17 12 L21.5 6.3 H28 V12Z" fill="#0d1522"/><path d="M30 6.3 H35.5 Q36.6 6.3 37.4 7.2 L41.6 12 H30Z" fill="#0d1522"/>' +
  '<rect class="hl" x="57.5" y="15" width="3.5" height="3" rx="1" fill="#fff3b0" stroke="rgba(0,0,0,.4)" stroke-width=".5"/><rect class="tl" x="3" y="15" width="2.6" height="3" fill="#e53935"/>' +
  '<path d="M56 21 H61.5" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/>' +
  '<circle cx="14" cy="24" r="5.2" fill="#151515"/><circle cx="14" cy="24" r="2" fill="#b8bec8"/><circle cx="50" cy="24" r="5.2" fill="#151515"/><circle cx="50" cy="24" r="2" fill="#b8bec8"/></svg>'; }

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
  if (serverNow() < g.startAt) return; // reading time
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
    var left = Math.ceil((g.startAt - now) / 1000), el = $('#countN'); if (el) el.textContent = left > 0 ? left : '…';
    if (now >= g.startAt) tryStep('go');
  } else if (g.phase === 'q') {
    var reading = now < g.startAt;
    if (reading !== S.wasReading) { S.wasReading = reading; S.panelKey = ''; renderPanel(); return; }
    if (reading) { var rn = $('#readN'); if (rn) rn.textContent = Math.max(1, Math.ceil((g.startAt - now) / 1000)); return; }
    var rem = (g.endAt - now) / 1000, L = g.limit;
    var n = $('#tnum'); if (n) n.textContent = fmtT(rem);
    var arc = $('#tarc'); if (arc) { var f = Math.max(0, Math.min(1, rem / L)); arc.setAttribute('stroke-dashoffset', String(276.5 * (1 - f))); arc.setAttribute('stroke', f > 0.5 ? '#19b46b' : f > 0.25 ? '#f5b301' : '#e5484d'); }
    var gain = $('#gain'); if (gain) { var el2 = L - rem, st = E.stepsFor(Math.max(0, el2), L); gain.textContent = st > 0 ? 'ഇപ്പോൾ ശരിയായാൽ +' + st + ' ചുവട്' : 'സമയം കഴിഞ്ഞു'; }
    if (E.allAnswered(r) || now >= g.endAt + E.GRACE_MS) tryStep('resolve', S.solo ? { bots: botAnswers() } : null);
  } else if (g.phase === 'rev') {
    if (now >= g.revEnd) tryStep('next');
  }
}

// ------------------------------------------------------------ engine sounds (Web Audio, made in code, no files)
function soundOn() { return LS.get('zrr_sound', true); }
var AC = null;
function audio() {
  if (!AC) { try { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
  return AC;
}
function noiseBuf(ac, sec) { var b = ac.createBuffer(1, Math.floor(ac.sampleRate * sec), ac.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function sfx(kind) {
  if (!soundOn()) return; var ac = audio(); if (!ac) return;
  try {
    var t = ac.currentTime + 0.02, out = ac.createGain(); out.gain.value = 0.32; out.connect(ac.destination);
    if (kind === 'vroom') { // short engine rev
      var o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1400, t + 0.35);
      o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.35); o.frequency.exponentialRampToValueAtTime(120, t + 0.7);
      o2.frequency.setValueAtTime(35, t); o2.frequency.exponentialRampToValueAtTime(95, t + 0.35); o2.frequency.exponentialRampToValueAtTime(60, t + 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.06); g.gain.setValueAtTime(0.9, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t + 0.8); o2.stop(t + 0.8);
    } else if (kind === 'sputter') { // breakdown "tuk tuk"
      [0, 0.17, 0.34, 0.56].forEach(function (d, i) {
        var o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'square'; f.type = 'lowpass'; f.frequency.value = 420;
        o.frequency.setValueAtTime(i === 3 ? 48 : 62, t + d); o.frequency.exponentialRampToValueAtTime(38, t + d + 0.1);
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(i === 3 ? 0.5 : 0.85, t + d + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
        o.connect(f); f.connect(g); g.connect(out); o.start(t + d); o.stop(t + d + 0.14);
      });
    } else if (kind === 'whoosh') { // small nitro whoosh
      var n = ac.createBufferSource(), bp = ac.createBiquadFilter(), g2 = ac.createGain(); n.buffer = noiseBuf(ac, 0.7);
      bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(3500, t + 0.45);
      g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.7, t + 0.12); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      n.connect(bp); bp.connect(g2); g2.connect(out); n.start(t); n.stop(t + 0.7);
    } else if (kind === 'fix') { // repair done: two soft clicks
      [0, 0.12].forEach(function (d) { var o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.09); o.connect(g); g.connect(out); o.start(t + d); o.stop(t + d + 0.1); });
    }
    window.ZRR.lastSfx = kind; (window.ZRR.sfxLog = window.ZRR.sfxLog || []).push(kind + '@' + (S.room && S.room.g ? S.room.g.phase : '-'));
  } catch (e) {}
}
function resultSound() {
  var x = S.room.g.res[S.me]; if (!x) return;
  if (x.k === 'ok') { sfx('vroom'); if (x.n) setTimeout(function () { sfx('whoosh'); }, 250); }
  else if (x.k === 'wrong' || x.k === 'to') sfx('sputter');
  else if (x.k === 'fix') sfx('fix');
}

// ------------------------------------------------------------ render
function show(id) { ['home', 'lobby', 'game', 'result'].forEach(function (x) { $('#' + x).hidden = x !== id; }); }
function render() {
  document.body.classList.toggle('inroom', !!S.room);
  renderTop();
  var r = S.room;
  if (!r) { show('home'); renderHome(); renderChat(); return; }
  if (r.status === 'lobby') { show('lobby'); renderLobby(); }
  else if (r.status === 'racing') { show('game'); renderGame(); }
  else { show('result'); renderResult(); }
  renderChat();
}
function renderTop() {
  var r = S.room, h = '';
  h += '<button class="chip" data-act="sound" title="എഞ്ചിൻ ശബ്ദം">' + (soundOn() ? '🔊' : '🔇') + '</button><button class="chip' + (voiceOn() ? '' : ' off') + '" data-act="voice" title="ചോദ്യം വായിക്കൽ">🗣️</button>';
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
  var nb = LS.get('zrr_bots', 3);
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
  h += '<div class="card"><h3>⚙️ ക്രമീകരണം</h3><div class="row"><button class="btn ' + (soundOn() ? '' : 'sec') + ' sm" data-act="sound">' + (soundOn() ? '🔊 എഞ്ചിൻ ശബ്ദം: ഓൺ' : '🔇 എഞ്ചിൻ ശബ്ദം: ഓഫ്') + '</button></div>' +
    '<div class="row" style="margin-top:8px"><button class="btn ' + (voiceOn() ? '' : 'sec') + ' sm" data-act="voice">' + (voiceOn() ? '🗣️ ചോദ്യം വായിക്കും' : '🗣️ ചോദ്യം വായിക്കില്ല') + '</button></div>' +
    (('speechSynthesis' in window) && !mlVoice() ? '<p class="small">ഈ ഫോണിൽ മലയാളം ശബ്ദം കണ്ടില്ല. ഉണ്ടെങ്കിൽ മാത്രം വായിക്കും.</p>' : '') + '<p class="small">എഞ്ചിൻ ശബ്ദം ഫലം വരുമ്പോൾ മാത്രം, ചോദ്യ സമയത്ത് ഇല്ല.</p></div>';
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
  if (!$('#lapline')) $('#game').innerHTML = '<div id="lapline" class="lapline"></div><div id="panel"></div><div id="board"><div id="racebar" class="card racebar"></div><div id="lead" class="card lead"></div></div><div id="gameFoot"></div>';
  var qLive = g.phase === 'q';
  renderLapline();
  // the question gets full focus: race bar + leaderboard are hidden while it is on screen
  var bd = $('#board'), wasHidden = bd.hidden; bd.hidden = qLive;
  if (!qLive) { renderRaceBar(wasHidden && g.phase === 'rev'); renderLead(); }
  renderPanel();
  if (qLive && S.spokenSeq !== g.seq) {
    S.spokenSeq = g.seq; try { window.scrollTo(0, 0); } catch (e) {}
    var x = E.questionFor(r, g.cars[S.me] && !g.cars[S.me].fin ? S.me : g.order[0], QS);
    if (x) speakQ(x.q);
  }
  if (g.phase === 'rev' && S.popSeq !== g.seq) { S.popSeq = g.seq; try { window.scrollTo(0, 0); } catch (e) {} resultSound(); }
}
function renderLapline() {
  var r = S.room, g = r.g, c = myCar(), lc = lapCp(g), rank = E.ranking(r), pos = rank.indexOf(S.me) + 1;
  var h = '<span class="lc">🏁 ലാപ്പ് ' + lc.lap + '/' + E.LAPS + ' · ചെക്ക്പോയിന്റ് ' + lc.cp + '/' + E.CPS + '</span>';
  if (c) h += '<span class="mini"><b>' + pos + '</b>/' + g.order.length + '</span><span class="mini ' + (c.b < E.BAT_LOW ? 'low' : '') + '">🔋' + Math.round(c.b) + '%</span><span class="mini">🔥' + [0, 1, 2].map(function (k) { return k < (c.st % 3) ? '●' : '○'; }).join('') + '</span>';
  else h += '<span class="mini">👀 കാണി</span>';
  $('#lapline').innerHTML = h;
}
// one thin lane per racer, static car icon; moves only after a result (quick <300 ms slide)
function renderRaceBar(slide) {
  var r = S.room, g = r.g, el = $('#racebar'), key = g.order.join(',');
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.innerHTML = '<div class="rbhead"><span>START</span><span>ലാപ്പ് 2</span><span>ലാപ്പ് 3</span><span>🏁</span></div>' + g.order.map(function (id) {
      var p = r.players[id] || {};
      return '<div class="lane' + (id === S.me ? ' me' : '') + '" data-id="' + esc(id) + '"><span class="ln">' + esc(p.name) + '</span><span class="lt"><i class="lm l1"></i><i class="lm l2"></i><span class="lcar">' + carSvg(col(p.col), 34) + '</span></span><span class="ls"></span></div>';
    }).join('');
  }
  el.classList.toggle('slide', !!slide);
  if (slide) void el.offsetWidth; // apply the old position first, then slide once
  g.order.forEach(function (id) {
    var row = el.querySelector('.lane[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); if (!row) return;
    var c = g.cars[id], pct = Math.max(0, Math.min(1, c.d / E.FINISH));
    row.querySelector('.lcar').style.left = 'calc(' + (pct * 100) + '% - ' + (pct * 34) + 'px)';
    row.querySelector('.ls').textContent = c.fin ? '🏁' + c.fin : c.pit ? '🔧' : String(c.d);
    row.classList.toggle('pit', !!c.pit);
  });
}
function renderLead() {
  var r = S.room, g = r.g, rank = E.ranking(r), prev = (g.phase === 'rev' && g.resR > 0 && g.prank && g.prank.length) ? g.prank : null; // no arrows after checkpoint 1 (everyone started level)
  $('#lead').innerHTML = '<div class="leadh">സ്ഥാനങ്ങൾ</div><div class="leadg">' + rank.map(function (id, i) {
    var p = r.players[id] || {}, c = g.cars[id], ch = prev ? prev.indexOf(id) - i : 0;
    var arrow = ch > 0 ? '<b class="up">▲' + ch + '</b>' : ch < 0 ? '<b class="dn">▼' + (-ch) + '</b>' : '<b class="eq">–</b>';
    return '<div class="lr' + (id === S.me ? ' me' : '') + '"><span class="lp">' + (i + 1) + '</span>' + carSvg(col(p.col), 20) + '<span class="lnm">' + esc(p.name) + '</span><span class="ld">' + (c.fin ? '🏁' : c.d) + '</span>' + arrow + '</div>';
  }).join('') + '</div>';
}
function speedoHtml(x) {
  var ok = x && x.k === 'ok', v = ok ? Math.min(1, x.d / 8) : 0, kmh = ok ? x.d * 25 : 0, ang = -90 + 180 * v;
  var ticks = ''; for (var i = 0; i <= 8; i++) { var a = (-90 + 22.5 * i) * Math.PI / 180, x1 = 60 + Math.sin(a) * 42, y1 = 62 - Math.cos(a) * 42, x2 = 60 + Math.sin(a) * 50, y2 = 62 - Math.cos(a) * 50; ticks += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + (i >= 6 ? '#e5484d' : '#93a3c4') + '" stroke-width="2"/>'; }
  return '<div class="speedo"><svg viewBox="0 0 120 72" width="150" aria-hidden="true"><path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#26355a" stroke-width="8" stroke-linecap="round"/>' +
    (v > 0 ? '<path d="M10 62 A50 50 0 0 1 ' + (60 + Math.sin(ang * Math.PI / 180) * 50).toFixed(1) + ' ' + (62 - Math.cos(ang * Math.PI / 180) * 50).toFixed(1) + '" fill="none" stroke="' + (x.n ? '#ff8a00' : '#19b46b') + '" stroke-width="8" stroke-linecap="round"/>' : '') + ticks +
    '<line x1="60" y1="62" x2="' + (60 + Math.sin(ang * Math.PI / 180) * 40).toFixed(1) + '" y2="' + (62 - Math.cos(ang * Math.PI / 180) * 40).toFixed(1) + '" stroke="#f5b301" stroke-width="3.5" stroke-linecap="round"/><circle cx="60" cy="62" r="5" fill="#f5b301"/></svg>' +
    '<div class="kmh"><b>' + kmh + '</b> km/h</div></div>';
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
  if (g.phase === 'count') { key = 'count' + g.seq; h = '<div class="card wait center">🚦 റേസ് തുടങ്ങുന്നു… <b id="countN"></b><div class="small">ഓരോ ചോദ്യത്തിനും ആദ്യം 3 സെക്കൻഡ് വായിക്കാൻ സമയം</div></div>'; }
  else if (g.phase === 'q') {
    var mine = c && !c.fin, done = mine && E.answered(r, S.me), x = E.questionFor(r, mine ? S.me : g.order.filter(function (id) { return !g.cars[id].pit; })[0] || g.order[0], QS);
    var waitN = E.waitIds(r).length, ansN = E.waitIds(r).filter(function (id) { return E.answered(r, id); }).length;
    var reading = now < g.startAt; S.wasReading = reading;
    key = 'q' + g.seq + (done ? 'd' : '') + (mine ? 'm' : '') + (reading ? 'r' : '');
    var an = $('#ansN'); if (an) an.textContent = ansN + '/' + waitN;
    if (S.panelKey === key) return;
    var tag = (mine && c.pit) ? '<div class="tagline pit">🔧 പിറ്റ് സ്റ്റോപ്പ്: റിപ്പയർ ചോദ്യം. ശരിയായാൽ കാർ തിരികെ റേസിൽ</div>' : '<div class="tagline">ചോദ്യം ' + (g.r + 1) + '/' + E.ROUNDS + '</div>';
    h = '<div class="card qcard">' + tag;
    if (reading) h += '<div class="qhead"><div class="readbox">വായിക്കൂ… <b id="readN">' + Math.max(1, Math.ceil((g.startAt - now) / 1000)) + '</b></div><div class="qmeta"><div class="small">ഉത്തരം നൽകാനുള്ള ' + limitTxt(g.limit) + ' ഇതിനു ശേഷം തുടങ്ങും</div><button class="btn sec sm" data-act="speakQ">🗣️ വീണ്ടും കേൾക്കുക</button></div></div>';
    else h += '<div class="qhead">' + ringHtml(g.limit, (g.endAt - now) / 1000) + '<div class="qmeta"><div id="gain" class="gain"></div><button class="btn sec sm" data-act="speakQ">🗣️ വീണ്ടും കേൾക്കുക</button>' + (S.solo ? '' : '<div class="small">ഉത്തരം നൽകിയവർ: <b id="ansN">' + ansN + '/' + waitN + '</b></div>') + '</div></div>';
    if (mine && !done) h += qCard(x, reading ? 'view' : 'answer');
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
      var good = res.k === 'ok' || res.k === 'fix';
      h += '<div class="resrow">' + speedoHtml(res) + '<div class="resline ' + res.k + '">' + resText(res) + '</div></div>' +
        '<div class="ansline"><div class="small">' + esc(xq.q) + '</div>' + (!good && res.c >= 0 ? '<div class="ra bad">നിങ്ങൾ: ' + esc(xq.o[res.c]) + '</div>' : '') + '<div class="ra good">ശരിയുത്തരം: ' + esc(xq.o[xq.a]) + '</div></div>';
    } else h += '<div class="wait">ഈ ചെക്ക്പോയിന്റിലെ ഫലം</div>';
    h += '</div>';
  } else { key = 'x'; h = ''; }
  if (S.panelKey === key) return;
  S.panelKey = key;
  $('#panel').innerHTML = h;
  var gf = $('#gameFoot'); if (gf && !gf.innerHTML) gf.innerHTML = '<button class="btn sec sm leavebtn" data-act="leave">' + (S.solo ? 'സോളോ നിർത്തുക' : 'റൂം വിടുക') + '</button>';
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
function renderResult() {
  var r = S.room, g = r.g, rank = g.rank || E.ranking(r), admin = E.isAdmin(r, S.me);
  $('#game').innerHTML = '';
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
  audio(); // unlock Web Audio on the first tap (phones need a user gesture)
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
  else if (a === 'sound') { LS.set('zrr_sound', !soundOn()); toast(soundOn() ? 'എഞ്ചിൻ ശബ്ദം ഓൺ' : 'എഞ്ചിൻ ശബ്ദം ഓഫ്', true); if (soundOn()) sfx('vroom'); render(); }
  else if (a === 'voice') { LS.set('zrr_voice', !voiceOn()); if (!voiceOn()) try { speechSynthesis.cancel(); } catch (e) {} toast(voiceOn() ? 'ചോദ്യം ഉറക്കെ വായിക്കും' : 'ശബ്ദം ഓഫ്', true); render(); }
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
