import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ---------- helpers ----------
const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
$(isTouch ? 'howKeys' : 'howTouch').classList.add('hidden');

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const HORIZON = 0xf6b78c;
scene.fog = new THREE.Fog(HORIZON, 140, 640);
scene.background = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#1d2550'); gr.addColorStop(0.3, '#5a4a86'); gr.addColorStop(0.48, '#e98a6a');
  gr.addColorStop(0.56, '#f6b78c'); gr.addColorStop(1, '#f6b78c');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 3000);

scene.add(new THREE.HemisphereLight(0xd6e4ff, 0x6b5a48, 1.7));
const sunLight = new THREE.DirectionalLight(0xffd6b0, 2.2);
sunLight.position.set(-0.5, 0.7, -0.6);
scene.add(sunLight);
const flashLight = new THREE.PointLight(0xffa040, 0, 90, 1);
scene.add(flashLight);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ---------- shared geometry / materials ----------
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);
const WHEEL = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14).rotateZ(Math.PI / 2);
const SPHERE = new THREE.SphereGeometry(0.5, 12, 10);
const CONE = new THREE.ConeGeometry(1, 1, 7);
const matCache = new Map();
function mat(color, emissive = 0) {
  const k = color + '|' + emissive;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color, emissive }));
  return matCache.get(k);
}
const shadowMat = new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false, opacity: 0.55,
  map: (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })(),
});

function box(parent, w, h, d, color, x, y, z, emissive = 0) {
  const m = new THREE.Mesh(BOX, mat(color, emissive));
  m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m;
}
function wheels(g, xs, zs, r = 0.36, t = 0.28) {
  g.userData.wheels = g.userData.wheels || [];
  for (const x of xs) for (const z of zs) {
    const m = new THREE.Mesh(WHEEL, mat(0x17171a));
    m.scale.set(t / 0.28, r / 0.36, r / 0.36); m.position.set(x, r, z);
    g.add(m); g.userData.wheels.push(m);
  }
}
function blob(g, w, l) {
  const m = new THREE.Mesh(PLANE, shadowMat);
  m.rotation.x = -Math.PI / 2; m.scale.set(w * 1.3, l * 1.15, 1); m.position.y = 0.04;
  m.userData.noBreak = true; g.add(m);
}
function lights(g, w, y, zf, zb) {
  box(g, 0.42, 0.14, 0.06, 0x330000, -w * 0.32, y, zb, 0xff1a1a);
  box(g, 0.42, 0.14, 0.06, 0x330000, w * 0.32, y, zb, 0xff1a1a);
  box(g, 0.4, 0.14, 0.06, 0xfff4d0, -w * 0.32, y, zf, 0xfff0b0);
  box(g, 0.4, 0.14, 0.06, 0xfff4d0, w * 0.32, y, zf, 0xfff0b0);
}
const GLASS = 0x1b2330;
const CAR_COLORS = [0x2f6fdb, 0xf2f2f2, 0x1c1c1c, 0xc9ccd2, 0x2a9d8f, 0xe9c46a, 0x8d99ae, 0x6a4c93, 0x3a86ff, 0xf4a261, 0x606c38, 0xb5179e, 0x9b2226];

// ---------- vehicle builders (front faces -z) ----------
function rider(shirt, helmet, lean) {
  const r = new THREE.Group();
  const torso = box(r, 0.42, 0.62, 0.28, shirt, 0, 0.3, 0);
  torso.rotation.x = -lean;
  const head = new THREE.Mesh(SPHERE, mat(helmet)); head.scale.setScalar(0.34);
  head.position.set(0, 0.68, -0.3 * Math.sin(lean) - 0.05); r.add(head);
  for (const s of [-1, 1]) {
    const arm = box(r, 0.12, 0.5, 0.12, shirt, s * 0.25, 0.32, -0.25); arm.rotation.x = -1.0;
    const leg = box(r, 0.15, 0.55, 0.15, 0x22304a, s * 0.16, -0.12, -0.12); leg.rotation.x = -0.6;
  }
  return r;
}
const BUILD = {
  car() {
    const g = new THREE.Group(), c = pick(CAR_COLORS);
    box(g, 1.8, 0.62, 4.2, c, 0, 0.62, 0);
    box(g, 1.56, 0.5, 2.1, c, 0, 1.17, 0.25);
    box(g, 1.62, 0.32, 2.16, GLASS, 0, 1.17, 0.25);
    box(g, 1.86, 0.22, 0.2, 0x222226, 0, 0.42, -2.12);
    box(g, 1.86, 0.22, 0.2, 0x222226, 0, 0.42, 2.12);
    lights(g, 1.8, 0.74, -2.11, 2.11);
    wheels(g, [-0.86, 0.86], [-1.35, 1.35]); blob(g, 1.9, 4.3);
    return { group: g, w: 1.9, l: 4.3, color: c };
  },
  suv() {
    const g = new THREE.Group(), c = pick(CAR_COLORS);
    box(g, 1.98, 0.85, 4.6, c, 0, 0.8, 0);
    box(g, 1.86, 0.72, 3.1, c, 0, 1.58, 0.35);
    box(g, 1.9, 0.42, 3.14, GLASS, 0, 1.6, 0.35);
    box(g, 1.5, 0.08, 2.4, 0x2a2a2e, 0, 1.98, 0.4);
    lights(g, 1.98, 0.95, -2.31, 2.31);
    wheels(g, [-0.94, 0.94], [-1.5, 1.5], 0.42, 0.32); blob(g, 2.0, 4.7);
    return { group: g, w: 2.0, l: 4.7, color: c };
  },
  van() {
    const g = new THREE.Group(), c = pick([0xf2f2f2, 0xdedede, 0x2f6fdb, 0xe9c46a]);
    box(g, 2.0, 1.9, 5.2, c, 0, 1.35, 0.2);
    box(g, 2.0, 0.9, 1.0, c, 0, 0.85, -2.85);
    box(g, 1.9, 0.6, 0.1, GLASS, 0, 1.75, -2.15);
    box(g, 2.04, 0.5, 1.4, GLASS, 0, 1.85, -1.4);
    lights(g, 2.0, 0.95, -3.36, 2.81);
    wheels(g, [-0.95, 0.95], [-2.2, 1.9], 0.4, 0.3); blob(g, 2.1, 6.0);
    return { group: g, w: 2.05, l: 6.3, color: c };
  },
  truck() {
    const g = new THREE.Group(), cab = pick([0xc1121f, 0x264653, 0xf4a261, 0x2f6fdb, 0xe9e9e9]);
    const tr = pick([0xeeeeee, 0xd9d9d9, 0x8d99ae, 0xb08968]);
    box(g, 2.0, 0.4, 9.6, 0x2a2a2e, 0, 0.75, 0);
    box(g, 2.35, 2.0, 2.2, cab, 0, 1.75, -3.7);
    box(g, 2.2, 0.75, 0.1, GLASS, 0, 2.15, -4.82);
    box(g, 2.5, 2.9, 7.2, tr, 0, 2.4, 1.15);
    box(g, 2.4, 0.3, 0.12, 0x222226, 0, 1.0, -4.85);
    lights(g, 2.4, 1.0, -4.86, 4.76);
    wheels(g, [-1.05, 1.05], [-3.7, 1.8, 3.4], 0.52, 0.42); blob(g, 2.5, 9.8);
    return { group: g, w: 2.5, l: 9.8, color: tr };
  },
  moto() {
    const g = new THREE.Group(), c = pick([0xd62828, 0x111111, 0xf77f00, 0x3a86ff, 0x2a9d8f]);
    box(g, 0.32, 0.4, 1.4, c, 0, 0.75, 0);
    box(g, 0.4, 0.3, 0.6, c, 0, 0.98, -0.25);
    box(g, 0.3, 0.12, 0.06, 0x330000, 0, 0.9, 0.72, 0xff1a1a);
    wheels(g, [0], [-0.72, 0.72], 0.34, 0.14);
    const r = rider(pick([0x222222, 0x8d0801, 0x1d3557]), pick([0xffffff, 0x111111, 0xffd166]), 0.6);
    r.position.set(0, 1.12, 0.15); g.add(r);
    blob(g, 0.8, 2.1);
    return { group: g, w: 0.8, l: 2.0, color: c };
  },
  bike() {
    const g = new THREE.Group(), c = pick([0x2a9d8f, 0xe63946, 0xffb703, 0x8338ec]);
    wheels(g, [0], [-0.55, 0.55], 0.34, 0.05);
    box(g, 0.06, 0.06, 1.0, c, 0, 0.62, 0).rotation.x = 0.15;
    box(g, 0.06, 0.55, 0.06, c, 0, 0.6, 0.2);
    box(g, 0.06, 0.5, 0.06, c, 0, 0.62, -0.42);
    box(g, 0.5, 0.05, 0.05, 0x222222, 0, 0.9, -0.45);
    const r = rider(pick([0xffd166, 0xef476f, 0x06d6a0, 0x118ab2, 0xffffff]), pick([0xffffff, 0xe63946, 0x222222]), 0.35);
    r.position.set(0, 1.12, 0.12); g.add(r);
    blob(g, 0.7, 1.8);
    return { group: g, w: 0.7, l: 1.8, color: c };
  },
  player() {
    const g = new THREE.Group(), c = 0xe0201a;
    box(g, 1.96, 0.5, 4.4, c, 0, 0.55, 0);
    box(g, 1.9, 0.26, 1.2, c, 0, 0.45, -2.5);
    box(g, 1.5, 0.42, 1.9, c, 0, 0.99, 0.25);
    box(g, 1.54, 0.28, 1.96, GLASS, 0, 0.99, 0.25);
    box(g, 0.32, 0.02, 5.5, 0xffffff, -0.25, 0.81, -0.4);
    box(g, 0.32, 0.02, 5.5, 0xffffff, 0.25, 0.81, -0.4);
    box(g, 0.08, 0.32, 0.1, 0x111111, -0.7, 0.95, 2.0);
    box(g, 0.08, 0.32, 0.1, 0x111111, 0.7, 0.95, 2.0);
    box(g, 2.0, 0.07, 0.45, 0x111111, 0, 1.13, 2.05);
    box(g, 1.6, 0.1, 0.05, 0x330000, 0, 0.66, 2.21, 0xff1a1a);
    box(g, 0.45, 0.1, 0.05, 0xfff4d0, -0.65, 0.52, -3.11, 0xfff0b0);
    box(g, 0.45, 0.1, 0.05, 0xfff4d0, 0.65, 0.52, -3.11, 0xfff0b0);
    box(g, 0.18, 0.18, 0.15, 0x333333, -0.5, 0.35, 2.22);
    box(g, 0.18, 0.18, 0.15, 0x333333, 0.5, 0.35, 2.22);
    wheels(g, [-0.93, 0.93], [-1.45, 1.4], 0.38, 0.34); blob(g, 2.0, 5.2);
    return { group: g, w: 1.96, l: 5.0, color: c };
  },
};

// ---------- road & scenery ----------
const ROAD_W = 22, TILE = 24, ROAD_LEN = 1200;
const roadTex = (() => {
  const W = 512, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); const mx = (x) => ((x + ROAD_W / 2) / ROAD_W) * W; const px = W / ROAD_W;
  g.fillStyle = '#3b3b42'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#323238'; g.fillRect(0, 0, mx(-8), H); g.fillRect(mx(8), 0, W - mx(8), H);
  for (let i = 0; i < 9000; i++) { const v = (50 + Math.random() * 30) | 0; g.fillStyle = `rgba(${v},${v},${v + 4},.5)`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  g.fillStyle = '#f2f2f2';
  g.fillRect(mx(-8) - 0.1 * px, 0, 0.2 * px, H); g.fillRect(mx(8) - 0.1 * px, 0, 0.2 * px, H);
  g.fillStyle = '#f4c430';
  g.fillRect(mx(-0.18) - 0.06 * px, 0, 0.12 * px, H); g.fillRect(mx(0.18) - 0.06 * px, 0, 0.12 * px, H);
  g.fillStyle = '#efefef';
  for (const x of [-4, 4]) g.fillRect(mx(x) - 0.08 * px, 0, 0.16 * px, H * (8 / 24));
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.repeat.set(1, ROAD_LEN / TILE); return t;
})();
const roadGroup = new THREE.Group(); scene.add(roadGroup);
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN), new THREE.MeshLambertMaterial({ map: roadTex }));
road.rotation.x = -Math.PI / 2; roadGroup.add(road);
const RAIL_X = 11.4;
for (const s of [-1, 1]) {
  const rail = box(roadGroup, 0.12, 0.32, ROAD_LEN, 0xc3c8d0, s * RAIL_X, 0.7, 0);
  rail.material = mat(0xc3c8d0);
  const posts = new THREE.InstancedMesh(BOX, mat(0x8a8f99), ROAD_LEN / 4);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < ROAD_LEN / 4; i++) {
    m4.compose(new V3(s * (RAIL_X + 0.1), 0.4, -ROAD_LEN / 2 + i * 4), new THREE.Quaternion(), new V3(0.12, 0.8, 0.12));
    posts.setMatrixAt(i, m4);
  }
  roadGroup.add(posts);
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mat(0x7c8f4e));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);

const SPAN = 1300;
const lamps = [], trees = [];
for (let i = 0; i < 26; i++) for (const s of [-1, 1]) {
  const g = new THREE.Group();
  box(g, 0.18, 8, 0.18, 0x6c717a, 0, 4, 0);
  box(g, 2.2, 0.14, 0.18, 0x6c717a, -s * 1.0, 7.9, 0);
  box(g, 0.7, 0.12, 0.35, 0xfff4d0, -s * 1.9, 7.8, 0, 0x887755);
  g.position.set(s * 12.6, 0, -i * 50 + (s > 0 ? 25 : 0)); scene.add(g); lamps.push(g);
}
for (let i = 0; i < 110; i++) {
  const g = new THREE.Group(), h = rand(4, 10);
  box(g, 0.4, h * 0.3, 0.4, 0x5b4636, 0, h * 0.15, 0);
  const cone = new THREE.Mesh(CONE, mat(pick([0x3d6b35, 0x4f7a3a, 0x2f5a35, 0x6b8e3d])));
  cone.scale.set(h * 0.32, h * 0.8, h * 0.32); cone.position.y = h * 0.3 + h * 0.4; g.add(cone);
  placeTree(g, -Math.random() * SPAN); scene.add(g); trees.push(g);
}
function placeTree(g, z) { g.position.set(pick([-1, 1]) * rand(15, 80), 0, z); }

const far = new THREE.Group(); scene.add(far);
for (let i = 0; i < 18; i++) {
  const m = new THREE.Mesh(CONE, new THREE.MeshBasicMaterial({ color: pick([0x8a6f9e, 0x9c7aa0, 0x7d6a99]), fog: false }));
  const h = rand(120, 320); m.scale.set(h * rand(1.4, 2.4), h, h * 1.5);
  m.position.set(rand(-2200, 2200), h / 2 - 10, -2000 - rand(0, 300)); far.add(m);
}
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(90, 32), new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false }));
sunDisc.position.set(-500, 140, -2400); far.add(sunDisc);

// speed streaks
const STREAKS = 90;
const streakGeo = new THREE.BufferGeometry();
streakGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 6), 3));
const streakMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
const streakLines = new THREE.LineSegments(streakGeo, streakMat); streakLines.frustumCulled = false; scene.add(streakLines);
const streaks = Array.from({ length: STREAKS }, () => ({ x: 0, y: 0, z: 1e9 }));

// ---------- particles: sparks + smoke/fire ----------
const SPARKS = 500;
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3).fill(-999), 3));
const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffb347, size: 0.13, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
sparkPts.frustumCulled = false; scene.add(sparkPts);
const sparks = Array.from({ length: SPARKS }, () => ({ p: new V3(0, -999, 0), v: new V3(), life: 0 }));
let sparkIdx = 0;
function spark(pos, vel, spread) {
  const s = sparks[sparkIdx++ % SPARKS];
  s.p.copy(pos); s.v.set(vel.x + rand(-spread, spread), vel.y + rand(0, spread), vel.z + rand(-spread, spread)); s.life = rand(0.3, 0.9);
}
const puffTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const puffs = [];
for (let i = 0; i < 90; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
  s.visible = false; scene.add(s); puffs.push({ s, v: new V3(), life: 0, max: 1, grow: 1, fire: false });
}
let puffIdx = 0;
function puff(pos, fire) {
  const p = puffs[puffIdx++ % puffs.length];
  p.s.position.copy(pos); p.s.visible = true; p.fire = fire;
  p.s.material.color.set(fire ? pick([0xff7b00, 0xffb000, 0xff4d00]) : pick([0x2b2b2b, 0x444444, 0x5a5a5a]));
  p.s.material.blending = fire ? THREE.AdditiveBlending : THREE.NormalBlending;
  p.v.set(rand(-1, 1), fire ? rand(2, 4) : rand(1.5, 3.5), rand(-1, 1));
  p.max = p.life = fire ? rand(0.4, 0.8) : rand(1.8, 3.2);
  p.grow = fire ? rand(1.5, 2.5) : rand(2.5, 4.5);
  p.s.scale.setScalar(fire ? 1.2 : 1.5);
}

// ---------- audio ----------
let ac = null, eng = null;
function initAudio() {
  if (ac) { ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), gn = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = -1200 + 7;
    f.type = 'lowpass'; f.frequency.value = 600; gn.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(gn); gn.connect(ac.destination); o1.start(); o2.start();
    eng = { o1, o2, f, gn };
  } catch { ac = null; }
}
function noiseBuf(sec) {
  const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
}
function sfxCrash(power) {
  if (!ac) return; const t = ac.currentTime;
  const n = ac.createBufferSource(); n.buffer = noiseBuf(2.5);
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(200, t + 2.2);
  const g = ac.createGain(); g.gain.setValueAtTime(0.9 * power, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
  n.connect(f); f.connect(g); g.connect(ac.destination); n.start(t);
  const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
  og.gain.setValueAtTime(1.0 * power, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  o.connect(og); og.connect(ac.destination); o.start(t); o.stop(t + 1.2);
  for (let i = 0; i < 6; i++) { // metal clanks
    const m = ac.createOscillator(), mg = ac.createGain(), ts = t + rand(0.05, 1.4);
    m.type = 'square'; m.frequency.value = rand(300, 1400);
    mg.gain.setValueAtTime(0.0001, t); mg.gain.setValueAtTime(0.12 * power, ts); mg.gain.exponentialRampToValueAtTime(0.0001, ts + 0.12);
    m.connect(mg); mg.connect(ac.destination); m.start(t); m.stop(ts + 0.15);
  }
}
function sfxWhoosh() {
  if (!ac) return; const t = ac.currentTime;
  const n = ac.createBufferSource(); n.buffer = noiseBuf(0.5);
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(2500, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.4);
  const g = ac.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  n.connect(f); f.connect(g); g.connect(ac.destination); n.start(t);
}

// ---------- input: keys, tilt, touch ----------
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (state === 'over' && overReady && ['Enter', 'Space', 'KeyR'].includes(e.code)) startRun();
  else if (state === 'menu' && ['Enter', 'Space'].includes(e.code)) startRun();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

let tiltRaw = null, tiltZero = 0, touching = 0, touchX = 0;
function onOrient(e) {
  if (e.gamma == null) return;
  const a = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
  if (a === 90) tiltRaw = e.beta;
  else if (a === -90 || a === 270) tiltRaw = -e.beta;
  else if (a === 180) tiltRaw = -e.gamma;
  else tiltRaw = e.gamma;
}
async function enableTilt() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') return;
    }
    addEventListener('deviceorientation', onOrient);
  } catch { /* no tilt; touch fallback */ }
}
const canvas = $('c');
canvas.addEventListener('touchstart', (e) => { touching = e.touches.length; touchX = e.touches[0].clientX; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchX = e.touches[0].clientX; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', (e) => { touching = e.touches.length; if (touching) touchX = e.touches[0].clientX; });
canvas.addEventListener('touchcancel', () => { touching = 0; });

function readSteer() {
  let s = 0;
  if (keys.ArrowLeft || keys.KeyA) s -= 1;
  if (keys.ArrowRight || keys.KeyD) s += 1;
  if (s === 0 && tiltRaw != null) {
    let d = tiltRaw - tiltZero;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    d = Math.abs(d) < 1.5 ? 0 : d - Math.sign(d) * 1.5;
    s = clamp(d / 20, -1, 1);
  } else if (s === 0 && tiltRaw == null && touching) {
    s = touchX < innerWidth / 2 ? -1 : 1; // no gyro: touch halves steer
  }
  return s;
}
const boosting = () => keys.ArrowUp || keys.KeyW || keys.Space || (tiltRaw != null && touching > 0);
const braking = () => keys.ArrowDown || keys.KeyS;

// ---------- game state ----------
let state = 'menu', overReady = false;
const P = { x: 2, vx: 0, z: 0, speed: 30, car: null };
let traffic = [], parts = [];
let score = 0, dist = 0, topSpeed = 0, nearMisses = 0, spawnAcc = 0, impactKmh = 0;
let crashT = 0, timeScale = 1, shake = 0, camOrbit = 0, crashFocus = new V3(), playerBody = null;
let best = 0; try { best = +localStorage.getItem('redline-best') || 0; } catch { }
const camPos = new V3(), camLook = new V3();

function newPlayer() {
  if (P.car) scene.remove(P.car.group);
  P.car = BUILD.player(); scene.add(P.car.group);
}
newPlayer();

const LANES_FWD = [2, 6], LANES_ONC = [-6, -2];
function spawnVehicle(x, z, vz, kind) {
  const b = BUILD[kind]();
  if (vz > 0) b.group.rotation.y = Math.PI;
  b.group.position.set(x, 0, z); scene.add(b.group);
  traffic.push({ ...b, x, vz, kind, passed: false, phase: rand(0, 6) });
}
function spawnRow(diff) {
  const z = P.z - 560;
  const lanes = [...LANES_ONC, ...LANES_FWD].sort(() => Math.random() - 0.5);
  let n = 1 + (Math.random() < 0.25 + diff * 0.45 ? 1 : 0) + (diff > 0.6 && Math.random() < 0.25 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const x = lanes[i], onc = x < 0;
    if (traffic.some((t) => Math.abs(t.x - x) < 1 && Math.abs(t.group.position.z - z) < 22)) continue;
    const r = Math.random();
    const kind = r < 0.5 ? 'car' : r < 0.64 ? 'suv' : r < 0.74 ? 'van' : r < 0.86 ? 'truck' : 'moto';
    const base = kind === 'truck' ? rand(17, 22) : kind === 'moto' ? rand(26, 34) : rand(20, 30);
    const vz = onc ? base + diff * 8 : -base;
    spawnVehicle(x + (kind === 'moto' ? rand(-0.8, 0.8) : 0), z, vz, kind);
  }
  if (Math.random() < 0.22) { // cyclist on the shoulder (or rarely, in a lane)
    const side = Math.random() < 0.6 ? 1 : -1;
    const x = Math.random() < 0.8 ? side * 9.6 : side * 6.8;
    spawnVehicle(x, z - 30, side > 0 ? -rand(6, 9) : rand(6, 9), 'bike');
  }
}

function clearWorld() {
  for (const t of traffic) scene.remove(t.group);
  for (const p of parts) scene.remove(p.obj);
  traffic = []; parts = [];
  for (const s of sparks) { s.life = 0; s.p.y = -999; }
  for (const p of puffs) { p.life = 0; p.s.visible = false; }
}

function startRun() {
  initAudio();
  tiltZero = tiltRaw ?? 0;
  clearWorld(); newPlayer();
  P.x = 2; P.vx = 0; P.speed = 38;
  score = 0; dist = 0; topSpeed = 0; nearMisses = 0; spawnAcc = 0;
  timeScale = 1; shake = 0; crashT = 0; overReady = false;
  state = 'play';
  $('menu').classList.add('hidden'); $('over').classList.add('hidden'); $('hud').classList.remove('hidden');
  if (eng) eng.gn.gain.setTargetAtTime(0.05, ac.currentTime, 0.2);
  try { navigator.wakeLock?.request('screen').catch(() => { }); } catch { }
}

$('startBtn').addEventListener('click', async () => {
  initAudio();
  await enableTilt();
  if (isTouch) { try { await document.documentElement.requestFullscreen?.(); } catch { } }
  setTimeout(startRun, 120); // let first orientation reading arrive for calibration
});
$('againBtn').addEventListener('click', () => { if (overReady) startRun(); });

function popup(text, hot) {
  const d = document.createElement('div'); d.className = 'pop' + (hot ? ' hot' : ''); d.textContent = text;
  $('pops').appendChild(d); setTimeout(() => d.remove(), 900);
}

// ---------- crash ----------
function explode(group, vSelf, vOther, rel, mix, isPlayer) {
  group.updateMatrixWorld(true);
  const center = group.position.clone();
  const children = [...group.children];
  let first = null;
  for (const ch of children) {
    if (ch.userData.noBreak) continue;
    scene.attach(ch);
    const dir = ch.getWorldPosition(new V3()).sub(center); dir.y = Math.max(dir.y, 0.3); dir.normalize();
    const v = vSelf.clone().lerp(vOther, mix);
    v.addScaledVector(dir, rand(2, 5 + rel * 0.1));
    v.x += rand(-1, 1) * Math.min(rel * 0.12, 14);
    v.y += rand(3, 6 + Math.min(rel * 0.2, 24));
    const sz = new THREE.Box3().setFromObject(ch).getSize(new V3());
    const p = { obj: ch, v, w: new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(rand(3, 12)), r: Math.max(0.08, Math.min(sz.x, sz.y, sz.z) * 0.5) };
    parts.push(p); if (!first) first = p;
  }
  scene.remove(group);
  return first;
}
function debris(pos, vel, colors, n, rel) {
  for (let i = 0; i < n; i++) {
    const glass = Math.random() < 0.4;
    const m = new THREE.Mesh(BOX, mat(glass ? 0x9fc3d9 : pick(colors)));
    const s = glass ? rand(0.06, 0.18) : rand(0.12, 0.45);
    m.scale.set(s, s * rand(0.2, 1), s * rand(0.5, 1.5));
    m.position.copy(pos).add(new V3(rand(-1, 1), rand(0.3, 1.5), rand(-1.5, 1.5)));
    m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); scene.add(m);
    const v = vel.clone().add(new V3(rand(-1, 1) * (8 + rel * 0.15), rand(4, 10 + rel * 0.25), rand(-1, 1) * (8 + rel * 0.15)));
    parts.push({ obj: m, v, w: new V3(rand(-20, 20), rand(-20, 20), rand(-20, 20)), r: s * 0.3 });
  }
}
function crash(other) {
  state = 'crash'; crashT = 0; camOrbit = 0;
  const pv = new V3(P.vx, 0, -P.speed);
  const ov = new V3(0, 0, other.vz);
  const rel = pv.distanceTo(ov);
  impactKmh = Math.round(rel * 3.6);
  const at = P.car.group.position.clone().lerp(other.group.position, 0.5); at.y = 0.8;
  playerBody = explode(P.car.group, pv, ov, rel, other.kind === 'bike' ? 0.1 : other.kind === 'truck' ? 0.75 : 0.5, true);
  explode(other.group, ov, pv, rel, other.kind === 'truck' ? 0.3 : 0.65, false);
  traffic.splice(traffic.indexOf(other), 1);
  const mid = pv.clone().lerp(ov, 0.5);
  debris(at, mid, [P.car.color, other.color, 0x222222], 50, rel);
  for (let i = 0; i < 160; i++) spark(at, mid.clone().multiplyScalar(0.6), 14 + rel * 0.1);
  for (let i = 0; i < 10; i++) puff(at.clone().add(new V3(rand(-1, 1), rand(0, 1), rand(-1, 1))), true);
  for (let i = 0; i < 8; i++) puff(at.clone().add(new V3(rand(-2, 2), rand(0, 1), rand(-2, 2))), false);
  flashLight.position.copy(at).add(new V3(0, 2, 0)); flashLight.intensity = 400;
  $('flash').style.transition = 'none'; $('flash').style.opacity = 0.85;
  requestAnimationFrame(() => { $('flash').style.transition = 'opacity .6s'; $('flash').style.opacity = 0; });
  shake = 1.2; timeScale = 1;
  crashFocus.copy(at);
  sfxCrash(clamp(rel / 90, 0.5, 1));
  if (eng) eng.gn.gain.setTargetAtTime(0, ac.currentTime, 0.05);
  navigator.vibrate?.([120, 40, 200]);
  $('hud').classList.add('hidden');
}
function showOver() {
  state = 'over';
  const s = Math.floor(score), isBest = s > best;
  if (isBest) { best = s; try { localStorage.setItem('redline-best', best); } catch { } }
  $('oScore').textContent = s.toLocaleString(); $('oBest').textContent = best.toLocaleString();
  $('oDist').textContent = (dist / 1000).toFixed(2) + ' km'; $('oTop').textContent = Math.round(topSpeed * 3.6) + ' km/h';
  $('oNear').textContent = nearMisses; $('oImpact').textContent = impactKmh + ' km/h';
  $('newbest').classList.toggle('hidden', !isBest);
  $('over').classList.remove('hidden');
  setTimeout(() => { overReady = true; }, 600);
}

// ---------- update ----------
function updatePlayer(dt) {
  const diff = clamp(dist / 9000, 0, 1);
  const base = 40 + 62 * (1 - Math.exp(-dist / 5000)); // ~144 → ~370 km/h
  let target = base + (boosting() ? 28 : 0);
  if (braking()) target = 30;
  P.speed += (target - P.speed) * Math.min(1, dt * (target > P.speed ? 0.9 : 2.5));
  const steer = readSteer();
  const maxLat = 13 + P.speed * 0.07;
  P.vx += (steer * maxLat - P.vx) * Math.min(1, dt * 9);
  P.x += P.vx * dt;
  const lim = RAIL_X - 1.1;
  if (Math.abs(P.x) > lim) { // grinding the guard rail
    P.x = Math.sign(P.x) * lim; P.vx = 0; P.speed *= 1 - 0.5 * dt; shake = Math.max(shake, 0.25);
    const sp = new V3(P.x + Math.sign(P.x) * 1, 0.6, P.z + rand(-1.5, 1.5));
    for (let i = 0; i < 3; i++) spark(sp, new V3(0, 1, -P.speed * 0.6), 4);
  }
  P.z -= P.speed * dt; dist += P.speed * dt;
  topSpeed = Math.max(topSpeed, P.speed);
  const oncoming = P.x < -0.5;
  score += P.speed * dt * (oncoming ? 2 : 1);
  $('mult').classList.toggle('on', oncoming);

  const g = P.car.group;
  g.position.set(P.x, 0, P.z);
  g.rotation.y = -P.vx * 0.022; g.rotation.z = P.vx * 0.008;

  spawnAcc += P.speed * dt;
  const gap = 78 - diff * 46;
  if (spawnAcc > gap) { spawnAcc = 0; spawnRow(diff); }

  if (eng) {
    eng.o1.frequency.setTargetAtTime(55 + P.speed * 1.5, ac.currentTime, 0.05);
    eng.o2.frequency.setTargetAtTime(55 + P.speed * 1.5, ac.currentTime, 0.05);
    eng.f.frequency.setTargetAtTime(350 + P.speed * 14 + (boosting() ? 900 : 0), ac.currentTime, 0.05);
  }
}

function updateTraffic(dt) {
  for (let i = traffic.length - 1; i >= 0; i--) {
    const t = traffic[i];
    if (state !== 'play') t.vz *= Math.exp(-1.2 * dt); // everyone hits the brakes after a crash
    t.group.position.z += t.vz * dt;
    if (t.kind === 'bike' || t.kind === 'moto') { t.phase += dt * 3; t.group.position.x = t.x + Math.sin(t.phase) * 0.12; t.group.rotation.z = Math.sin(t.phase) * 0.05; }
    const z = t.group.position.z;
    if (z > P.z + 40 || z < P.z - 1100) { scene.remove(t.group); traffic.splice(i, 1); continue; }
    if (state !== 'play') continue;
    // collision
    const dx = Math.abs(t.group.position.x - P.x), dz = Math.abs(z - P.z);
    if (dx < (t.w + P.car.w) * 0.45 && dz < (t.l + P.car.l) * 0.45) { crash(t); return; }
    // near miss
    if (!t.passed && z > P.z + t.l / 2) {
      t.passed = true;
      const gapX = dx - (t.w + P.car.w) / 2;
      if (gapX < 1.1) {
        nearMisses++; const bonus = t.vz > 0 ? 500 : 250; score += bonus;
        popup(`NEAR MISS +${bonus}`, t.vz > 0); sfxWhoosh(); shake = Math.max(shake, 0.25);
      }
    }
  }
  // same-lane vehicles don't drive through each other
  for (const a of traffic) for (const b of traffic) {
    if (a === b || Math.abs(a.x - b.x) > 1.2 || Math.sign(a.vz) !== Math.sign(b.vz)) continue;
    const ahead = (b.group.position.z - a.group.position.z) * Math.sign(a.vz);
    if (ahead > 0 && ahead < (a.l + b.l) / 2 + 8 && Math.abs(a.vz) > Math.abs(b.vz)) a.vz = b.vz;
  }
}

const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
function updateParts(dt) {
  for (const p of parts) {
    p.v.y -= 24 * dt;
    p.obj.position.addScaledVector(p.v, dt);
    tmpE.set(p.w.x * dt, p.w.y * dt, p.w.z * dt); tmpQ.setFromEuler(tmpE); p.obj.quaternion.multiply(tmpQ);
    const pos = p.obj.position;
    if (pos.y < p.r) {
      pos.y = p.r;
      const hspeed = Math.hypot(p.v.x, p.v.z);
      if (p.v.y < -2) { p.v.y = -p.v.y * 0.32; p.w.multiplyScalar(0.7); } else p.v.y = 0;
      const f = Math.exp(-2.6 * dt); p.v.x *= f; p.v.z *= f; p.w.multiplyScalar(Math.exp(-2.5 * dt));
      if (hspeed > 12 && Math.random() < 0.25) spark(pos, new V3(p.v.x * 0.5, 2, p.v.z * 0.5), 3);
    }
    if (Math.abs(pos.x) > RAIL_X - 0.2 && pos.y < 1.2) { pos.x = Math.sign(pos.x) * (RAIL_X - 0.2); p.v.x *= -0.4; }
  }
}

function updateParticles(dt) {
  const arr = sparkGeo.attributes.position.array;
  for (let i = 0; i < SPARKS; i++) {
    const s = sparks[i];
    if (s.life > 0) {
      s.life -= dt; s.v.y -= 20 * dt; s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.05) { s.p.y = 0.05; s.v.y *= -0.4; s.v.x *= 0.7; s.v.z *= 0.7; }
      if (s.life <= 0) s.p.y = -999;
    }
    arr[i * 3] = s.p.x; arr[i * 3 + 1] = s.p.y; arr[i * 3 + 2] = s.p.z;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  for (const p of puffs) {
    if (p.life <= 0) continue;
    p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
    p.s.position.addScaledVector(p.v, dt);
    p.s.scale.multiplyScalar(1 + p.grow * dt * 0.5);
    const k = p.life / p.max;
    p.s.material.opacity = p.fire ? k * 0.9 : Math.min(1, (1 - k) * 4) * k * 0.6;
  }
  flashLight.intensity *= Math.exp(-5 * dt);
}

function updateScenery() {
  const pz = P.z;
  roadGroup.position.z = Math.round(pz / TILE) * TILE - 450;
  ground.position.set(P.x, -0.05, pz);
  far.position.set(0, 0, pz);
  for (const l of lamps) if (l.position.z > pz + 30) l.position.z -= SPAN;
  for (const t of trees) if (t.position.z > pz + 30) placeTree(t, t.position.z - SPAN);
  // speed streaks
  const sp = state === 'play' ? P.speed : 0;
  const arr = streakGeo.attributes.position.array, len = sp * 0.11;
  for (let i = 0; i < STREAKS; i++) {
    const s = streaks[i];
    if (s.z > pz + 4 || s.z < pz - 220) {
      s.z = pz - rand(20, 200); s.x = P.x + pick([-1, 1]) * rand(3, 14); s.y = rand(0.3, 6);
    }
    arr.set([s.x, s.y, s.z, s.x, s.y, s.z + len], i * 6);
  }
  streakGeo.attributes.position.needsUpdate = true;
  streakMat.opacity = clamp((sp - 55) / 50, 0, 0.55);
}

function spinWheels(group, v, dt) {
  for (const w of group.userData.wheels || []) w.rotation.x -= (v * dt) / 0.36;
}

function updateCamera(rdt, dt) {
  const portrait = camera.aspect < 1;
  if (state === 'play' || state === 'menu') {
    const back = (portrait ? 9.5 : 7.2) + P.speed * 0.012, up = (portrait ? 4.2 : 3.0) + P.speed * 0.006;
    camPos.set(P.x * 0.85, up, P.z + back);
    camLook.set(P.x * 0.9, 1.0, P.z - 18);
    camera.position.copy(camPos);
    const fovBase = portrait ? 78 : 64;
    camera.fov = fovBase + clamp((P.speed - 35) * 0.32, 0, 30) + (boosting() && state === 'play' ? 4 : 0);
    camera.rotation.z = 0;
  } else {
    // follow the wreck, slowly orbiting
    if (playerBody) crashFocus.lerp(playerBody.obj.position, 1 - Math.exp(-4 * dt));
    camOrbit += rdt * 0.45;
    const r = 11 + Math.min(crashT * 1.5, 6);
    const target = new V3(crashFocus.x + Math.sin(camOrbit) * r, 4.5 + Math.min(crashT, 3), crashFocus.z + Math.cos(camOrbit) * r);
    camera.position.lerp(target, 1 - Math.exp(-3 * rdt));
    camLook.lerp(crashFocus, 1 - Math.exp(-6 * rdt));
    camera.fov += (60 - camera.fov) * (1 - Math.exp(-2 * rdt));
  }
  camera.lookAt(camLook);
  const jitter = shake * 0.35 + (state === 'play' ? clamp((P.speed - 70) / 300, 0, 0.06) : 0);
  if (jitter > 0) camera.position.add(new V3(rand(-1, 1) * jitter, rand(-1, 1) * jitter, 0));
  shake *= Math.exp(-4 * rdt);
  camera.updateProjectionMatrix();
}

// ---------- loop ----------
let last = performance.now(), hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  tick(Math.min(0.05, (now - last) / 1000)); last = now;
}
function tick(rdt) {
  if (state === 'crash' || state === 'over') {
    crashT += rdt;
    // impact frame at full speed, then dramatic slow motion, then ease back to real time
    timeScale = crashT < 0.06 ? 1 : crashT < 1.4 ? 0.14 : Math.min(1, 0.14 + (crashT - 1.4) * 0.45);
    if (state === 'crash' && crashT > 3.6) showOver();
  } else timeScale = 1;
  const dt = rdt * timeScale;

  if (state === 'menu') {
    P.speed = 34; P.z -= P.speed * dt; P.x += (2 - P.x) * dt;
    P.car.group.position.set(P.x, 0, P.z);
  } else if (state === 'play') updatePlayer(dt);

  if (state === 'play' || state === 'menu') spinWheels(P.car.group, P.speed, dt);
  for (const t of traffic) spinWheels(t.group, Math.abs(t.vz), dt);
  updateTraffic(dt);
  if (state === 'crash' || state === 'over') {
    updateParts(dt);
    // the wreck burns
    if (playerBody && Math.random() < 0.5 * (dt / 0.016)) {
      const p = playerBody.obj.position.clone().add(new V3(rand(-0.6, 0.6), 0.4, rand(-0.6, 0.6)));
      puff(p, Math.random() < 0.45);
    }
  }
  updateParticles(dt);
  updateScenery();
  updateCamera(rdt, dt);

  hudT -= rdt;
  if (state === 'play' && hudT <= 0) {
    hudT = 0.08;
    $('speed').textContent = Math.round(P.speed * 3.6);
    $('scoreV').textContent = Math.floor(score).toLocaleString();
    $('distV').textContent = (dist / 1000).toFixed(1) + ' km';
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend(); else ac.resume();
});

// debug hook for automated testing
window.__game = { P, get state() { return state; }, get traffic() { return traffic; }, startRun, crash, tick, keys };
