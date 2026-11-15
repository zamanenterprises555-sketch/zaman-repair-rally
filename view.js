/* Zaman Repair Rally - race view.
 * RaceView.create(el, '3d' | 'lite', opts) -> { update(snap), setCam(mode), destroy(), fps() }
 * 3D uses Three.js (vendor/three.min.js, MIT). Lite mode is a plain 2D canvas for weak phones.
 * Cars only: no drivers, people or animals anywhere (tinted windows).
 */
(function (root) {
  'use strict';
  var LAP = 50, FIN = 150, LANE_W = 1.15, HALF_W = 7.2, PIT_OFF = -(HALF_W + 1.5), SHOULDER = 2.6;
  // ---------------------------------------------------------------- track (shared)
  var CTRL = [[0, -62], [38, -60], [62, -38], [58, -8], [36, 8], [44, 34], [26, 60], [-8, 62], [-34, 46], [-40, 18], [-62, 4], [-62, -32], [-38, -56]];
  var N = 1400, TX = [], TZ = [], DX = [], DZ = [], CUM = [], LEN = 0;
  (function build() {
    function cr(p0, p1, p2, p3, t) {
      var t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    var raw = [], n = CTRL.length, per = 200;
    for (var i = 0; i < n; i++) {
      var p0 = CTRL[(i - 1 + n) % n], p1 = CTRL[i], p2 = CTRL[(i + 1) % n], p3 = CTRL[(i + 2) % n];
      for (var k = 0; k < per; k++) { var t = k / per; raw.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]); }
    }
    var cum = [0]; for (var j = 1; j <= raw.length; j++) { var a = raw[j - 1], b = raw[j % raw.length]; cum.push(cum[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    LEN = cum[raw.length];
    var idx = 0;
    for (var s = 0; s <= N; s++) {
      var L = s / N * LEN; while (idx < raw.length - 1 && cum[idx + 1] < L) idx++;
      var A = raw[idx], B = raw[(idx + 1) % raw.length], f = (L - cum[idx]) / ((cum[idx + 1] - cum[idx]) || 1);
      TX.push(A[0] + (B[0] - A[0]) * f); TZ.push(A[1] + (B[1] - A[1]) * f); CUM.push(L);
    }
    for (var q = 0; q <= N; q++) { var p = (q - 1 + N) % N, nx = (q + 1) % N; var dx = TX[nx] - TX[p], dz = TZ[nx] - TZ[p], l = Math.hypot(dx, dz) || 1; DX.push(dx / l); DZ.push(dz / l); }
  })();
  // point on track: u = lap fraction 0..1, off = lateral offset (+ = left of travel)
  function at(u, off) {
    u = ((u % 1) + 1) % 1; var f = u * N, i = Math.floor(f), t = f - i, j = i + 1;
    var x = TX[i] + (TX[j] - TX[i]) * t, z = TZ[i] + (TZ[j] - TZ[i]) * t;
    var dx = DX[i] + (DX[j] - DX[i]) * t, dz = DZ[i] + (DZ[j] - DZ[i]) * t, l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    var nx = dz, nz = -dx; // left normal (x-z plane, viewed from above with z down)
    return { x: x + nx * (off || 0), z: z + nz * (off || 0), dx: dx, dz: dz, nx: nx, nz: nz };
  }
  function laneOff(lane, n) { return (lane - (n - 1) / 2) * LANE_W; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function hex(c) { return parseInt(String(c).replace('#', ''), 16); }
  function now() { return (root.performance && performance.now) ? performance.now() : Date.now(); }

  // ---------------------------------------------------------------- car state (shared animation)
  function CarState(c) { this.id = c.id; this.dd = c.d; this.from = c.d; this.to = c.d; this.t0 = 0; this.dur = 1; this.lat = 0; this.latT = 0; this.nitroUntil = 0; this.smokeUntil = 0; this.pit = 0; this.speed = 0; this.fin = 0; this.lane = c.lane; this.n = c.n; }
  function stepStates(states, snap, tnow, lastSeq) {
    var ids = {};
    (snap.cars || []).forEach(function (c) {
      ids[c.id] = 1;
      var s = states[c.id]; if (!s) { s = states[c.id] = new CarState(c); s.lat = s.latT = c.pit ? PIT_OFF : laneOff(c.lane, c.n); }
      s.name = c.name; s.col = c.col; s.me = c.me; s.lane = c.lane; s.n = c.n; s.fin = c.fin;
      var target = c.fin ? Math.max(c.d, FIN) : c.d;
      if (target !== s.to) {
        var r = (snap.res || {})[c.id] || {};
        s.from = s.dd; s.to = target; s.t0 = tnow + 250; s.dur = r.n ? 2300 : 2600;
        if (r.n) s.nitroUntil = tnow + 2900;
      }
      if (snap.seq !== lastSeq) {
        var rr = (snap.res || {})[c.id] || {};
        if (snap.phase === 'rev' && (rr.k === 'wrong' || rr.k === 'to')) s.smokeUntil = tnow + 3600;
      }
      s.pit = c.pit; s.latT = c.pit ? PIT_OFF : laneOff(c.lane, c.n);
    });
    Object.keys(states).forEach(function (id) { if (!ids[id]) delete states[id]; });
  }
  function advance(s, tnow, dt) {
    var prev = s.dd;
    if (tnow < s.t0) s.dd = s.from; else if (tnow >= s.t0 + s.dur) s.dd = s.to; else s.dd = s.from + (s.to - s.from) * ease((tnow - s.t0) / s.dur);
    if (s.fin && s.dd >= FIN && tnow >= s.t0 + s.dur) s.dd = Math.min(s.dd, FIN + 1.2);
    s.lat += (s.latT - s.lat) * Math.min(1, dt * 2.2);
    s.speed = dt > 0 ? (s.dd - prev) / dt : 0;
    // grid stagger at the start (2 rows) so 11 cars are not one flat line
    var stag = s.dd < 0.6 ? ((s.lane % 2) ? -0.035 : 0) * (1 - s.dd / 0.6) : 0;
    return (s.dd / LAP) + stag;
  }

  // ---------------------------------------------------------------- canvas helpers
  function labelCanvas(text, col, me) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 64; var x = c.getContext('2d');
    x.font = '700 30px "Noto Sans Malayalam", system-ui, sans-serif';
    var w = Math.min(244, x.measureText(text).width + 34);
    x.fillStyle = me ? 'rgba(245,179,1,.95)' : 'rgba(10,16,30,.82)';
    roundRect(x, (256 - w) / 2, 6, w, 52, 18); x.fill();
    x.fillStyle = col; x.beginPath(); x.arc((256 - w) / 2 + 17, 32, 8, 0, 7); x.fill();
    x.fillStyle = me ? '#1b1300' : '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128 + 8, 33, w - 34);
    return c;
  }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function textCanvas(lines, bg, fg, w, h, size) {
    var c = document.createElement('canvas'); c.width = w || 512; c.height = h || 128; var x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach(function (l, i) { x.font = (l.b ? '900 ' : '700 ') + (l.s || size || 48) + 'px "Noto Sans", system-ui, sans-serif'; x.fillStyle = l.c || fg; x.fillText(l.t, c.width / 2, c.height * (i + 0.5) / lines.length, c.width - 16); });
    return c;
  }
  function checkerCanvas(nx, ny) {
    var c = document.createElement('canvas'); c.width = nx * 16; c.height = ny * 16; var x = c.getContext('2d');
    for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 16, j * 16, 16, 16); }
    return c;
  }
  function wrenchCanvas() {
    var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
    x.fillStyle = 'rgba(245,179,1,.95)'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill();
    x.translate(64, 64); x.rotate(-0.8); x.fillStyle = '#1b2233';
    x.fillRect(-9, -8, 18, 52); x.beginPath(); x.arc(0, -22, 22, 0, 7); x.fill();
    x.fillStyle = 'rgba(245,179,1,1)'; x.fillRect(-8, -48, 16, 26);
    return c;
  }
  function smokeCanvas() {
    var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
    var g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(90,90,95,.95)'); g.addColorStop(0.6, 'rgba(130,130,135,.6)'); g.addColorStop(1, 'rgba(150,150,150,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c;
  }

  // ================================================================ 3D
  function create3D(el, opts) {
    var T = root.THREE; if (!T) throw new Error('no three');
    var renderer = new T.WebGLRenderer({ antialias: (root.devicePixelRatio || 1) < 2, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
    if (!renderer.getContext()) throw new Error('no webgl');
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));
    el.appendChild(renderer.domElement); renderer.domElement.className = 'race-canvas';
    var scene = new T.Scene(); scene.background = new T.Color(0x9fd3f5); scene.fog = new T.Fog(0x9fd3f5, 90, 260);
    var cam = new T.PerspectiveCamera(58, 1, 0.3, 900);
    scene.add(new T.HemisphereLight(0xffffff, 0x4a6b3a, 0.85));
    var sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(60, 120, 40); scene.add(sun);
    var MAT = {};
    function lam(c, o) { var k = c + (o ? JSON.stringify(o) : ''); if (!MAT[k]) MAT[k] = new T.MeshLambertMaterial(Object.assign({ color: c }, o || {})); return MAT[k]; }
    function tex(canvas) { var t = new T.CanvasTexture(canvas); t.anisotropy = 4; return t; }
    function mesh(geo, mat, x, y, z) { var m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }

    // ground
    var ground = mesh(new T.PlaneGeometry(700, 700), lam(0x5d9447)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    // strips along the track: (offA, offB, y, colourFn)
    function strip(offA, offB, y, colorFn, step) {
      step = step || 2; var pos = [], col = [], idx = [], k = 0;
      for (var s = 0; s <= N; s += step) {
        var u = s / N, a = at(u, offA), b = at(u, offB), c = new T.Color(colorFn(s));
        pos.push(a.x, y, a.z, b.x, y, b.z); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (s > 0) idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
        k += 2;
      }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      var m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); scene.add(m); return m;
    }
    strip(HALF_W, -HALF_W, 0.02, function () { return 0x3b3f47; });
    strip(-HALF_W, -HALF_W - SHOULDER, 0.021, function () { return 0x5a606b; });                 // pit lane
    strip(-HALF_W - SHOULDER, -HALF_W - SHOULDER - 0.25, 0.03, function () { return 0xf5c400; }); // pit lane line
    strip(HALF_W, HALF_W + 0.8, 0.03, function (s) { return Math.floor(s / 12) % 2 ? 0xffffff : 0xd62828; }, 6); // kerb
    strip(-HALF_W, -HALF_W + 0.35, 0.03, function () { return 0xffffff; });
    // lane dashes
    (function () {
      var pos = [], idx = [], k = 0;
      for (var l = 1; l < 11; l++) {
        var off = -HALF_W + 0.7 + l * ((2 * HALF_W - 1.4) / 11);
        for (var s = 0; s < N; s += 14) {
          var a1 = at(s / N, off - 0.06), a2 = at(s / N, off + 0.06), b1 = at((s + 6) / N, off - 0.06), b2 = at((s + 6) / N, off + 0.06);
          pos.push(a1.x, 0.035, a1.z, a2.x, 0.035, a2.z, b1.x, 0.035, b1.z, b2.x, 0.035, b2.z); idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); k += 4;
        }
      }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      scene.add(new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xdfe6ef, transparent: true, opacity: 0.35, side: T.DoubleSide })));
    })();
    // gate across the track at u (posts + banner)
    function gate(u, canvas, h, color) {
      var p = at(u, 0), g = new T.Group(), w = 2 * HALF_W + 1.6;
      var post = new T.BoxGeometry(0.4, h, 0.4);
      g.add(mesh(post, lam(color), -w / 2, h / 2, 0)); g.add(mesh(post, lam(color), w / 2, h / 2, 0));
      var ban = mesh(new T.BoxGeometry(w + 0.4, 1.3, 0.25), [lam(color), lam(color), lam(color), lam(color), new T.MeshBasicMaterial({ map: tex(canvas) }), new T.MeshBasicMaterial({ map: tex(canvas) })], 0, h, 0);
      g.add(ban);
      g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.dx, p.dz); scene.add(g); return g;
    }
    // start / finish
    (function () {
      var p = at(0, 0), line = mesh(new T.PlaneGeometry(2 * HALF_W, 1.4), new T.MeshBasicMaterial({ map: tex(checkerCanvas(16, 2)) }));
      line.rotation.x = -Math.PI / 2; line.rotation.z = Math.atan2(p.dx, p.dz); line.position.set(p.x, 0.04, p.z); scene.add(line);
      gate(0, textCanvas([{ t: 'START  •  FINISH', b: 1, s: 60 }], '#111827', '#f5b301', 1024, 128), 5.2, 0x1f2937);
    })();
    for (var k = 1; k < 10; k++) gate(k / 10, textCanvas([{ t: 'CHECKPOINT ' + k, b: 1, s: 56 }], '#0b5f3a', '#fff', 768, 112), 4.4, 0x0f8a50);
    // waving finish flag (checkered)
    var flagGeo = new T.PlaneGeometry(2.4, 1.5, 12, 6), flagBase = flagGeo.attributes.position.array.slice();
    var flag = mesh(flagGeo, new T.MeshBasicMaterial({ map: tex(checkerCanvas(8, 5)), side: T.DoubleSide }));
    (function () { var p = at(0.004, HALF_W + 2.2); var pole = mesh(new T.CylinderGeometry(0.08, 0.08, 6, 6), lam(0xdddddd), p.x, 3, p.z); scene.add(pole); flag.position.set(p.x + 1.2 * p.dx, 5.2, p.z + 1.2 * p.dz); flag.rotation.y = Math.atan2(p.dx, p.dz) - Math.PI / 2; scene.add(flag); })();
    // pit garage beside the start straight
    (function () {
      var p = at(0.955, PIT_OFF - 4.2), g = new T.Group();
      g.add(mesh(new T.BoxGeometry(14, 3.4, 4), lam(0xe5e7eb), 0, 1.7, -1)); g.add(mesh(new T.BoxGeometry(14.6, 0.35, 5.4), lam(0xd62828), 0, 3.55, -0.3));
      for (var i = 0; i < 4; i++) g.add(mesh(new T.BoxGeometry(2.8, 2.6, 0.1), lam(0x1f2937), -5.1 + i * 3.4, 1.3, 1.02));
      var sign = mesh(new T.PlaneGeometry(6, 1.1), new T.MeshBasicMaterial({ map: tex(textCanvas([{ t: 'PIT  STOP  🔧', b: 1, s: 64 }], '#f5b301', '#1b1300', 768, 140)) }), 0, 4.4, 1.0);
      g.add(sign);
      g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.dx, p.dz) - Math.PI / 2; scene.add(g);
    })();
    // billboards: the academy
    var adTex = tex(textCanvas([{ t: 'ZAMAN SMARTPHONE', b: 1, s: 64, c: '#f5b301' }, { t: 'REPAIR ACADEMY', b: 1, s: 64, c: '#fff' }, { t: 'VALANCHERY', s: 40, c: '#9fe3c1' }], '#0b1324', '#fff', 768, 300));
    [0.13, 0.38, 0.63, 0.86].forEach(function (u) {
      var p = at(u, HALF_W + 7), g = new T.Group();
      g.add(mesh(new T.BoxGeometry(0.3, 4, 0.3), lam(0x666666), -3, 2, 0)); g.add(mesh(new T.BoxGeometry(0.3, 4, 0.3), lam(0x666666), 3, 2, 0));
      var b = mesh(new T.PlaneGeometry(8, 3.1), new T.MeshBasicMaterial({ map: adTex, side: T.DoubleSide }), 0, 5, 0); g.add(b);
      g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.nx, p.nz) + Math.PI; scene.add(g);
    });
    // giant smartphone sculpture in the infield
    (function () {
      var g = new T.Group(), sc = textCanvas([{ t: 'ZAMAN', b: 1, s: 90, c: '#f5b301' }, { t: '📱🔧', s: 90 }, { t: 'REPAIR', b: 1, s: 70 }], '#0f2a20', '#fff', 300, 560);
      g.add(mesh(new T.BoxGeometry(7, 13, 1), lam(0x111827), 0, 7, 0));
      var scr = mesh(new T.PlaneGeometry(6.2, 11.6), new T.MeshBasicMaterial({ map: tex(sc) }), 0, 7, 0.51); g.add(scr);
      var scr2 = scr.clone(); scr2.rotation.y = Math.PI; scr2.position.z = -0.51; g.add(scr2);
      g.position.set(-4, 0, -8); g.rotation.y = 0.6; scene.add(g);
    })();
    // grandstand (empty seats) and tyre stacks
    (function () {
      var p = at(0.03, HALF_W + 6), g = new T.Group();
      for (var i = 0; i < 4; i++) g.add(mesh(new T.BoxGeometry(16, 0.8, 1.4), lam(i % 2 ? 0x2563eb : 0x1e40af), 0, 0.4 + i * 0.8, -i * 1.4));
      g.add(mesh(new T.BoxGeometry(16.6, 0.3, 6.6), lam(0xd62828), 0, 4.2, -2.1));
      g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.dx, p.dz) + Math.PI / 2; scene.add(g);
      var tg = new T.CylinderGeometry(0.55, 0.55, 0.4, 10);
      [0.08, 0.22, 0.31, 0.47, 0.56, 0.71, 0.79, 0.93].forEach(function (u, i) {
        var q = at(u, (i % 2 ? 1 : -1) * (HALF_W + (i % 2 ? 2.6 : SHOULDER + 1.6)));
        for (var j = 0; j < 3; j++) for (var h = 0; h < 3; h++) scene.add(mesh(tg, lam(h % 2 ? 0xffffff : 0x222222), q.x + (j - 1) * 1.15 * q.dx, 0.2 + h * 0.4, q.z + (j - 1) * 1.15 * q.dz));
      });
    })();

    // ------------------------------------------------ cars
    var WHEEL = new T.CylinderGeometry(0.19, 0.19, 0.16, 12), HUB = new T.BoxGeometry(0.17, 0.3, 0.06);
    var GLASS = new T.MeshLambertMaterial({ color: 0x0d1522, emissive: 0x05080f }), BLACK = lam(0x151515), GREY = lam(0xb8bec8);
    var HEAD = new T.MeshBasicMaterial({ color: 0xfff3b0 }), TAIL = new T.MeshBasicMaterial({ color: 0xff2a2a });
    var FL1 = new T.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
    var FL2 = new T.MeshBasicMaterial({ color: 0x5fb6ff, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
    var smokeMat = new T.SpriteMaterial({ map: tex(smokeCanvas()), transparent: true, depthWrite: false, opacity: 0.8 });
    var sparkMat = new T.SpriteMaterial({ color: 0xffd34d, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    var wrenchTex = tex(wrenchCanvas());
    function makeCar(col) {
      var g = new T.Group(), body = new T.Group(); g.add(body);
      var paint = new T.MeshLambertMaterial({ color: hex(col) }), dark = new T.MeshLambertMaterial({ color: new T.Color(hex(col)).multiplyScalar(0.55) });
      body.add(mesh(new T.BoxGeometry(0.86, 0.24, 1.75), paint, 0, 0.3, 0));
      var nose = mesh(new T.BoxGeometry(0.8, 0.14, 0.55), paint, 0, 0.47, 0.55); nose.rotation.x = 0.12; body.add(nose);
      body.add(mesh(new T.BoxGeometry(0.66, 0.27, 0.74), GLASS, 0, 0.56, -0.12));   // tinted cabin, nobody visible
      body.add(mesh(new T.BoxGeometry(0.68, 0.05, 0.56), paint, 0, 0.71, -0.14));
      body.add(mesh(new T.BoxGeometry(0.9, 0.05, 0.2), dark, 0, 0.66, -0.82));
      body.add(mesh(new T.BoxGeometry(0.06, 0.2, 0.06), BLACK, -0.3, 0.52, -0.8)); body.add(mesh(new T.BoxGeometry(0.06, 0.2, 0.06), BLACK, 0.3, 0.52, -0.8));
      body.add(mesh(new T.BoxGeometry(0.88, 0.06, 0.3), dark, 0, 0.2, 0.86));
      body.add(mesh(new T.BoxGeometry(0.16, 0.07, 0.04), HEAD, -0.27, 0.36, 0.88)); body.add(mesh(new T.BoxGeometry(0.16, 0.07, 0.04), HEAD, 0.27, 0.36, 0.88));
      body.add(mesh(new T.BoxGeometry(0.18, 0.07, 0.04), TAIL, -0.27, 0.36, -0.88)); body.add(mesh(new T.BoxGeometry(0.18, 0.07, 0.04), TAIL, 0.27, 0.36, -0.88));
      var wheels = [];
      [[-0.46, 0.55], [0.46, 0.55], [-0.46, -0.58], [0.46, -0.58]].forEach(function (w) {
        var wg = new T.Group(); wg.position.set(w[0], 0.19, w[1]);
        var tyre = new T.Mesh(WHEEL, BLACK); tyre.rotation.z = Math.PI / 2; wg.add(tyre);
        var hub = new T.Mesh(HUB, GREY); hub.position.x = w[0] > 0 ? 0.085 : -0.085; wg.add(hub);
        body.add(wg); wheels.push(wg);
      });
      var fl = new T.Group(); fl.position.set(0, 0.3, -0.95);
      [-0.22, 0.22].forEach(function (x) {
        var o = new T.Mesh(new T.ConeGeometry(0.17, 1.4, 8), FL1); o.rotation.x = -Math.PI / 2; o.position.set(x, 0, -0.66); fl.add(o);
        var i2 = new T.Mesh(new T.ConeGeometry(0.08, 0.7, 6), FL2); i2.rotation.x = -Math.PI / 2; i2.position.set(x, 0, -0.33); fl.add(i2);
      });
      fl.visible = false; body.add(fl);
      var shadow = new T.Mesh(new T.PlaneGeometry(1.1, 2), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.045; g.add(shadow);
      // pit scene parts: jack, garage frame, wrench sign
      var pit = new T.Group(); pit.visible = false; g.add(pit);
      var pf = lam(0xf5b301);
      pit.add(mesh(new T.BoxGeometry(0.1, 2.2, 0.1), pf, -0.85, 1.1, 1.1)); pit.add(mesh(new T.BoxGeometry(0.1, 2.2, 0.1), pf, 0.85, 1.1, 1.1));
      pit.add(mesh(new T.BoxGeometry(0.1, 2.2, 0.1), pf, -0.85, 1.1, -1.1)); pit.add(mesh(new T.BoxGeometry(0.1, 2.2, 0.1), pf, 0.85, 1.1, -1.1));
      pit.add(mesh(new T.BoxGeometry(1.9, 0.08, 2.4), lam(0xd62828), 0, 2.2, 0));
      pit.add(mesh(new T.BoxGeometry(0.5, 0.18, 0.5), lam(0x333333), 0, 0.09, 0));
      var tool = mesh(new T.BoxGeometry(0.5, 0.3, 0.3), lam(0xd62828), 0.75, 0.15, 0.2); pit.add(tool);
      var wrench = new T.Sprite(new T.SpriteMaterial({ map: wrenchTex, depthTest: false })); wrench.scale.set(0.9, 0.9, 1); wrench.position.set(0, 2.9, 0); pit.add(wrench);
      g.userData = { body: body, wheels: wheels, flames: fl, pit: pit, wrench: wrench, paint: paint };
      scene.add(g); return g;
    }
    function makeLabel(text, col, me) {
      var t = tex(labelCanvas(text, col, me)); var s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
      s.renderOrder = 10; scene.add(s); return s;
    }
    var particles = [];
    function puff(x, y, z, spark) {
      var sp; for (var i = 0; i < particles.length; i++) if (!particles[i].alive && particles[i].spark === !!spark) { sp = particles[i]; break; }
      if (!sp) { if (particles.length > 90) return; sp = { s: new T.Sprite(spark ? sparkMat : smokeMat.clone()), spark: !!spark }; scene.add(sp.s); particles.push(sp); }
      sp.alive = true; sp.life = 0; sp.max = spark ? 0.5 : 1.6; sp.s.visible = true; sp.s.position.set(x, y, z);
      sp.v = spark ? [(Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3] : [(Math.random() - 0.5) * 0.4, 1 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4];
    }
    var states = {}, cars = {}, lastSeq = null, snap = { cars: [] }, camMode = 'follow', focus = null, alive = true, raf = 0, last = now(), puffT = 0;
    var camPos = new T.Vector3(0, 60, 80), camLook = new T.Vector3();
    var fpsFrames = 0, fpsT0 = now(), fpsVal = 60, fpsSamples = [], fpsWarned = false, startT = now();
    var ovDist = 150;
    function resize() { var w = el.clientWidth || 360, h = el.clientHeight || 300; var tf = Math.tan(29 * Math.PI / 180); ovDist = Math.max(76 / (tf * (w / h)), 76 / tf) * 1.02; renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; cam.aspect = w / h; cam.updateProjectionMatrix(); }
    resize(); var ro = root.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(el); else root.addEventListener('resize', resize);
    function update(s) {
      snap = s || snap; var tn = now();
      stepStates(states, snap, tn, lastSeq); lastSeq = snap.seq; focus = snap.focus;
      Object.keys(cars).forEach(function (id) { if (!states[id]) { scene.remove(cars[id]); scene.remove(cars[id].userData.label); delete cars[id]; } });
      Object.keys(states).forEach(function (id) {
        var st = states[id], c = cars[id];
        var key = st.name + st.col + (st.me ? 1 : 0);
        if (!c) { c = cars[id] = makeCar(st.col); }
        if (c.userData.key !== key) { if (c.userData.label) scene.remove(c.userData.label); c.userData.label = makeLabel(st.name, st.col, st.me); c.userData.key = key; c.userData.paint.color.setHex(hex(st.col)); }
      });
    }
    function frame() {
      if (!alive) return; raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      var tn = now(), dt = Math.min(0.1, (tn - last) / 1000); last = tn; var ts = tn / 1000;
      // fps watch (after a short warm-up)
      fpsFrames++; if (tn - fpsT0 >= 2000) { fpsVal = fpsFrames * 1000 / (tn - fpsT0); fpsFrames = 0; fpsT0 = tn; if (tn - startT > 3000) { fpsSamples.push(fpsVal); if (fpsSamples.length > 3) fpsSamples.shift(); if (!fpsWarned && fpsSamples.length === 3 && (fpsSamples[0] + fpsSamples[1] + fpsSamples[2]) / 3 < 22) { fpsWarned = true; if (opts.onLowFps) opts.onLowFps(fpsVal); } } }
      var emit = (tn - puffT) > 90; if (emit) puffT = tn;
      var lblOverview = camMode === 'overview';
      Object.keys(states).forEach(function (id) {
        var st = states[id], c = cars[id]; if (!c) return; var ud = c.userData;
        var u = advance(st, tn, dt), p = at(u, st.lat), p2 = at(u + 0.004, st.lat + (st.latT - st.lat) * 0.3);
        c.position.set(p.x, 0, p.z); c.rotation.y = Math.atan2(p2.x - p.x, p2.z - p.z);
        var moving = Math.abs(st.speed) > 0.05;
        ud.wheels.forEach(function (w) { w.rotation.x += st.speed * dt * 9 + (st.pit ? dt * 3 : 0); });
        var nit = tn < st.nitroUntil; ud.flames.visible = nit;
        if (nit) { var f = 0.7 + Math.random() * 0.6; ud.flames.scale.set(1, 1, f * (moving ? 1.4 : 0.8)); }
        ud.pit.visible = !!st.pit && Math.abs(st.lat - PIT_OFF) < 0.6;
        ud.body.position.y = ud.pit.visible ? 0.16 + Math.sin(ts * 3) * 0.02 : (moving ? Math.sin(ts * 40) * 0.01 : 0);
        ud.body.rotation.z = (tn < st.smokeUntil && !moving) ? Math.sin(ts * 30) * 0.03 : 0;
        if (ud.pit.visible) { ud.wrench.material.rotation = Math.sin(ts * 5) * 0.6; if (emit && Math.random() < 0.6) puff(p.x + p.nx * 0.5, 0.35, p.z + p.nz * 0.5, true); }
        if (emit && (tn < st.smokeUntil || st.pit)) puff(p.x + (Math.random() - 0.5) * 0.4, 0.7, p.z + (Math.random() - 0.5) * 0.4, false);
        if (emit && nit && moving) puff(p.x - p.dx * 1.4, 0.35, p.z - p.dz * 1.4, true);
        var L = ud.label; if (L) {
          var hgt = lblOverview ? 3 + (st.lane % 3) * ovDist / 40 : 1.15 + (st.lane % 3) * 0.32 + (st.me ? 0.25 : 0); L.position.set(p.x, hgt + (ud.pit.visible ? 2.1 : 0), p.z);
          var sc = lblOverview ? ovDist / 34 : (st.me ? 0.72 : 0.5); L.scale.set(sc * 4, sc, 1);
        }
      });
      particles.forEach(function (q) {
        if (!q.alive) return; q.life += dt; if (q.life > q.max) { q.alive = false; q.s.visible = false; return; }
        var k = q.life / q.max; q.s.position.x += q.v[0] * dt; q.s.position.y += q.v[1] * dt; q.s.position.z += q.v[2] * dt;
        if (q.spark) { q.v[1] -= 9 * dt; q.s.scale.set(0.12, 0.12, 1); q.s.material.opacity = 1 - k; }
        else { var sz = 0.8 + k * 2.6; q.s.scale.set(sz, sz, 1); q.s.material.opacity = 0.85 * (1 - k); }
      });
      // flag
      var pa = flagGeo.attributes.position; for (var i = 0; i < pa.count; i++) { var bx = flagBase[i * 3]; pa.array[i * 3 + 2] = Math.sin(bx * 2.5 + ts * 6) * 0.18 * (bx + 1.2) / 2.4; } pa.needsUpdate = true;
      // camera
      var target = focus && states[focus] ? states[focus] : null;
      if (!target && camMode === 'follow') { var best = null; Object.keys(states).forEach(function (id) { if (!best || states[id].dd > best.dd) best = states[id]; }); target = best; }
      var wantPos, wantLook;
      if (camMode === 'follow' && target && cars[target.id]) {
        var cu = target.dd / LAP, cp = at(cu, target.lat * (target.pit ? 0.9 : 0.6));
        wantPos = new T.Vector3(cp.x - cp.dx * 9.5, 5.4, cp.z - cp.dz * 9.5);
        var la = at(cu + 0.03, target.lat * 0.4); wantLook = new T.Vector3(la.x, 0.5, la.z);
      } else { wantPos = new T.Vector3(0, ovDist * 0.92, ovDist * 0.4); wantLook = new T.Vector3(0, 0, 2); }
      var k2 = 1 - Math.exp(-dt * 3.2); camPos.lerp(wantPos, k2); camLook.lerp(wantLook, k2);
      scene.fog.far = camMode === 'overview' ? ovDist * 3 : 260;
      cam.position.copy(camPos); cam.lookAt(camLook);
      renderer.render(scene, cam);
    }
    raf = requestAnimationFrame(frame);
    return {
      mode: '3d', update: update,
      setCam: function (m) { camMode = m; },
      cam: function () { return camMode; },
      fps: function () { return Math.round(fpsVal); },
      info: function () { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, cars: Object.keys(cars).length }; },
      destroy: function () { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {} if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }
    };
  }

  // ================================================================ Lite 2D
  function createLite(el, opts) {
    var cv = document.createElement('canvas'); cv.className = 'race-canvas'; el.appendChild(cv);
    var x = cv.getContext('2d'), dpr = Math.min(root.devicePixelRatio || 1, 2), W = 0, H = 0, sc = 1, ox = 0, oz = 0;
    var minX = Math.min.apply(null, TX) - 12, maxX = Math.max.apply(null, TX) + 12, minZ = Math.min.apply(null, TZ) - 12, maxZ = Math.max.apply(null, TZ) + 12;
    function resize() { W = el.clientWidth || 360; H = el.clientHeight || 300; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; var aw = W - 8, ah = Math.max(80, H - 96); sc = Math.min(aw / (maxX - minX), ah / (maxZ - minZ)); ox = (W - (maxX - minX) * sc) / 2 - minX * sc; oz = 50 + (ah - (maxZ - minZ) * sc) / 2 - minZ * sc; }
    resize(); var ro = root.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(el);
    function P(px, pz) { return [ox + px * sc, oz + pz * sc]; }
    function path(off) { x.beginPath(); for (var s = 0; s <= N; s += 7) { var p = at(s / N, off), q = P(p.x, p.z); if (s) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); } x.closePath(); }
    var states = {}, lastSeq = null, snap = { cars: [] }, alive = true, raf = 0, last = now(), smoke = [];
    function update(s) { snap = s || snap; stepStates(states, snap, now(), lastSeq); lastSeq = snap.seq; }
    function frame() {
      if (!alive) return; raf = requestAnimationFrame(frame); if (document.hidden) return;
      var tn = now(), dt = Math.min(0.1, (tn - last) / 1000); last = tn;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = '#4f8a3c'; x.fillRect(0, 0, W, H);
      x.lineJoin = 'round';
      path(-HALF_W - SHOULDER / 2); x.strokeStyle = '#6b7280'; x.lineWidth = SHOULDER * sc; x.stroke();
      path(0); x.strokeStyle = '#fff'; x.lineWidth = (2 * HALF_W + 1) * sc; x.stroke();
      x.strokeStyle = '#3b3f47'; x.lineWidth = 2 * HALF_W * sc; x.stroke();
      x.setLineDash([3, 5]); x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 1; path(-HALF_W / 2); x.stroke(); path(HALF_W / 2); x.stroke(); x.setLineDash([]);
      // start line + checkpoints
      for (var k = 0; k < 10; k++) {
        var a = at(k / 10, HALF_W), b = at(k / 10, -HALF_W), A = P(a.x, a.z), B = P(b.x, b.z);
        x.strokeStyle = k ? '#19b46b' : '#fff'; x.lineWidth = k ? 2 : 5; x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.stroke();
        var c = at(k / 10, HALF_W + 4), C = P(c.x, c.z); x.fillStyle = k ? '#c9f5df' : '#f5b301'; x.font = '700 ' + Math.max(9, sc * 4) + 'px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(k ? String(k) : '🏁', C[0], C[1]);
      }
      var pp = at(0.955, PIT_OFF - 3.5), PP = P(pp.x, pp.z); x.fillStyle = '#f5b301'; x.font = '800 ' + Math.max(9, sc * 3.5) + 'px system-ui'; x.fillText('PIT', PP[0], PP[1]);
      var list = Object.keys(states).map(function (id) { return states[id]; }).sort(function (p, q) { return (p.me ? 1 : 0) - (q.me ? 1 : 0); });
      var labels = [];
      list.forEach(function (st) {
        var u = advance(st, tn, dt), p = at(u, st.lat), Q = P(p.x, p.z), ang = Math.atan2(p.dz, p.dx);
        var L = Math.max(10, 2.2 * sc * 1.25), Wd = Math.max(6, 1.1 * sc * 1.25);
        if (tn < st.nitroUntil) { x.save(); x.translate(Q[0], Q[1]); x.rotate(ang); x.fillStyle = Math.random() < 0.5 ? '#ff8a00' : '#ffd34d'; x.beginPath(); x.moveTo(-L / 2, -Wd / 3); x.lineTo(-L / 2 - L * (0.6 + Math.random() * 0.5), 0); x.lineTo(-L / 2, Wd / 3); x.fill(); x.restore(); }
        if ((tn < st.smokeUntil || st.pit) && Math.random() < 0.3) smoke.push({ x: Q[0], y: Q[1], r: 3, a: 0.7 });
        x.save(); x.translate(Q[0], Q[1]); x.rotate(ang);
        x.fillStyle = st.col; roundRect(x, -L / 2, -Wd / 2, L, Wd, Wd / 3); x.fill(); x.lineWidth = st.me ? 2.5 : 1; x.strokeStyle = st.me ? '#f5b301' : 'rgba(0,0,0,.6)'; x.stroke();
        x.fillStyle = '#0d1522'; x.fillRect(-L * 0.1, -Wd * 0.32, L * 0.32, Wd * 0.64);
        x.restore();
        if (st.pit) { x.font = Math.max(12, sc * 4) + 'px system-ui'; x.fillText('🔧', Q[0], Q[1] - Wd - 4); }
        labels.push({ x: Q[0], y: Q[1] - Wd - (st.pit ? 16 : 6), t: st.name, me: st.me, col: st.col });
      });
      smoke = smoke.filter(function (s) { s.r += dt * 14; s.a -= dt * 0.8; s.y -= dt * 8; if (s.a <= 0) return false; x.fillStyle = 'rgba(160,160,160,' + s.a + ')'; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 7); x.fill(); return true; });
      // name labels (pushed apart vertically if they overlap)
      labels.sort(function (p, q) { return p.y - q.y; });
      var placed = [];
      labels.forEach(function (l) {
        x.font = '700 11px "Noto Sans Malayalam", system-ui'; var w = x.measureText(l.t).width + 10, y = l.y;
        for (var g = 0; g < 12; g++) { var hit = placed.some(function (b) { return Math.abs(b.x - l.x) < (b.w + w) / 2 && Math.abs(b.y - y) < 15; }); if (!hit) break; y -= 15; }
        placed.push({ x: l.x, y: y, w: w });
        x.fillStyle = l.me ? '#f5b301' : 'rgba(10,16,30,.85)'; roundRect(x, l.x - w / 2, y - 8, w, 15, 7); x.fill();
        x.fillStyle = l.me ? '#1b1300' : '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(l.t, l.x, y);
      });
    }
    raf = requestAnimationFrame(frame);
    return { mode: 'lite', update: update, setCam: function () {}, cam: function () { return 'overview'; }, fps: function () { return 60; }, info: function () { return { cars: Object.keys(states).length }; },
      destroy: function () { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (cv.parentNode) cv.parentNode.removeChild(cv); } };
  }

  function webglOk() { try { var c = document.createElement('canvas'); return !!(root.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }
  root.RaceView = {
    webglOk: webglOk, at: at, LEN: function () { return LEN; },
    create: function (el, mode, opts) {
      opts = opts || {};
      if (mode === '3d') { try { return create3D(el, opts); } catch (e) { console.warn('3D failed', e); if (opts.onFail) opts.onFail(e); } }
      return createLite(el, opts);
    }
  };
})(this);
