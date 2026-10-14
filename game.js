import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ---------- helpers ----------
const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.add(isTouch ? 'touch' : 'keys');

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
const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 3000);

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
  bus() {
    const g = new THREE.Group(), c = pick([0xf4c430, 0x1d4e89, 0xe9e9e9, 0xc1121f, 0x2a9d8f]);
    box(g, 2.5, 2.8, 12, c, 0, 1.9, 0);
    box(g, 2.54, 0.95, 10.4, GLASS, 0, 2.45, 0.5);
    box(g, 2.3, 1.3, 0.1, GLASS, 0, 2.3, -6.02);
    box(g, 2.52, 0.18, 12.02, 0xffffff, 0, 1.55, 0);
    box(g, 2.2, 0.35, 3.5, 0xbfbfbf, 0, 3.45, 1.5);
    lights(g, 2.5, 0.95, -6.03, 6.03);
    wheels(g, [-1.1, 1.1], [-4.2, 3.8], 0.55, 0.4); blob(g, 2.6, 12.2);
    return { group: g, w: 2.5, l: 12, color: c };
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

// ---------- roadside detail ----------
const side = () => pick([-1, 1]);
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), yAxis = new V3(0, 1, 0);
const ROOF = new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const TOWER = new THREE.CylinderGeometry(0.5, 1.1, 1, 10);
const ROCK = new THREE.DodecahedronGeometry(0.5, 0);

// gravel strip behind the guard rails + wooden fences, all snapped with the road
for (const s of [-1, 1]) {
  const gravel = new THREE.Mesh(PLANE, mat(0x8c7d68));
  gravel.rotation.x = -Math.PI / 2; gravel.scale.set(3, ROAD_LEN, 1); gravel.position.set(s * 12.5, -0.02, 0);
  roadGroup.add(gravel);
  const fx = s * 17;
  for (const y of [0.55, 1.05]) box(roadGroup, 0.08, 0.12, ROAD_LEN, 0x8b6b4a, fx, y, 0);
  const fp = new THREE.InstancedMesh(BOX, mat(0x6f5238), ROAD_LEN / 6);
  for (let i = 0; i < ROAD_LEN / 6; i++) {
    m4.compose(new V3(fx, 0.6, -ROAD_LEN / 2 + i * 6), q4.identity(), new V3(0.16, 1.3, 0.16)); fp.setMatrixAt(i, m4);
  }
  roadGroup.add(fp);
}
// power line on the right, poles every 72 m (same period as the road snap)
{
  const n = ROAD_LEN / 72, px = 30;
  const poles = new THREE.InstancedMesh(BOX, mat(0x5e4b3c), n), arms = new THREE.InstancedMesh(BOX, mat(0x5e4b3c), n);
  for (let i = 0; i < n; i++) {
    const z = -ROAD_LEN / 2 + i * 72;
    m4.compose(new V3(px, 5.5, z), q4.identity(), new V3(0.35, 11, 0.35)); poles.setMatrixAt(i, m4);
    m4.compose(new V3(px, 10.4, z), q4.identity(), new V3(3.6, 0.22, 0.22)); arms.setMatrixAt(i, m4);
  }
  roadGroup.add(poles, arms);
  for (const dx of [-1.6, 0, 1.6]) box(roadGroup, 0.04, 0.04, ROAD_LEN, 0x222222, px + dx, dx === 0 ? 10.9 : 10.5, 0);
}

const props = [];
function prop(obj, place, margin = 40) { place(obj, -Math.random() * SPAN); scene.add(obj); props.push({ obj, place, margin }); }

function makeHouse() {
  const g = new THREE.Group(), w = rand(6, 10), d = rand(6, 9), h = rand(3, 5.5);
  box(g, w, h, d, pick([0xe9dcc9, 0xd4a373, 0xf1e3b4, 0xc9d6df, 0xe5989b, 0xfafafa, 0xb7b7a4, 0x9fb8ad]), 0, h / 2, 0);
  const roof = new THREE.Mesh(ROOF, mat(pick([0x6d3b2a, 0x3d405b, 0x8d2f23, 0x4a4e69, 0x5c4033])));
  roof.scale.set(w, rand(2, 3.4), d); roof.position.y = h + roof.scale.y / 2; g.add(roof);
  for (const i of [-1, 1]) {
    const lit = Math.random() < 0.5;
    box(g, 0.08, 1.1, 1.3, lit ? 0x6b5030 : 0x2b3a4f, w / 2 + 0.02, h * 0.58, i * d * 0.28, lit ? 0x8a5a20 : 0);
  }
  box(g, 0.08, 2.0, 1.0, 0x5b3a29, w / 2 + 0.02, 1.0, 0);
  box(g, 0.7, 2.2, 0.7, 0x7f5539, w * 0.22, h + 1.3, d * 0.2);
  box(g, 0.1, 0.9, d + 6, 0xf5f5f5, w / 2 + 4, 0.45, 0); // picket fence out front
  return g;
}
function makeFarm() {
  const g = new THREE.Group(), w = rand(9, 12), d = rand(14, 18), h = rand(5, 7);
  box(g, w, h, d, pick([0xa4161a, 0x8c2f39, 0x9d0208]), 0, h / 2, 0);
  const roof = new THREE.Mesh(ROOF, mat(0x3b3b3b)); roof.scale.set(w * 1.05, 4, d * 1.02); roof.position.y = h + 2; g.add(roof);
  box(g, 0.1, 4, 4, 0xf1f1f1, w / 2 + 0.02, 2, 0);
  box(g, 0.12, 0.3, 5.4, 0xf1f1f1, w / 2 + 0.05, 2, 0).rotation.x = 0.75;
  box(g, 0.12, 0.3, 5.4, 0xf1f1f1, w / 2 + 0.05, 2, 0).rotation.x = -0.75;
  const silo = new THREE.Mesh(CYL, mat(0xb8c0c8)); silo.scale.set(2.2, 14, 2.2); silo.position.set(-1, 7, -d / 2 - 3); g.add(silo);
  const cap = new THREE.Mesh(SPHERE, mat(0x8d99ae)); cap.scale.setScalar(4.4); cap.position.set(-1, 14, -d / 2 - 3); g.add(cap);
  return g;
}
function signTex(lines, bg, fg, w = 512, h = 256, border = '#fff') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach(([t, size], i) => { g.font = `900 italic ${size}px Arial Black, Arial, sans-serif`; g.fillText(t, w / 2, h * (i + 1) / (lines.length + 1)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const BILLBOARDS = [
  signTex([['REDLINE RUSH', 64], ['FLAT OUT SINCE 2026', 30]], '#e0201a', '#fff'),
  signTex([["JOE'S DINER", 70], ['BURGERS · SHAKES · EXIT 12', 28]], '#ffd166', '#3a1d0e', 512, 256, '#3a1d0e'),
  signTex([['MOTEL', 80], ['VACANCY · POOL · 2 km', 30]], '#1d3557', '#f1faee'),
  signTex([['SLOW DOWN?', 66], ['NEVER.', 54]], '#111', '#ffd166', 512, 256, '#ffd166'),
  signTex([['SUNSET CITY', 66], ['48 km', 48]], '#2a9d8f', '#fff'),
  signTex([['FRESH PEACHES', 58], ['NEXT RIGHT', 36]], '#f4a261', '#fff'),
].map((t) => new THREE.MeshLambertMaterial({ map: t }));
function makeBillboard() {
  const g = new THREE.Group();
  for (const x of [-2.2, 2.2]) box(g, 0.3, 6.5, 0.3, 0x55595f, x, 3.25, -0.3);
  box(g, 6.6, 3.4, 0.25, 0x33363b, 0, 7.4, -0.2);
  const face = new THREE.Mesh(PLANE, pick(BILLBOARDS)); face.scale.set(6.3, 3.1, 1); face.position.set(0, 7.4, -0.06); g.add(face);
  box(g, 6.6, 0.12, 0.8, 0x55595f, 0, 5.65, 0.1);
  return g;
}
const GANTRY_SIGNS = [
  signTex([['EXIT 27 ↗', 70], ['AIRPORT · HARBOR', 40]], '#0b6e3a', '#fff'),
  signTex([['SUNSET CITY', 64], ['CENTER  ↑  32 km', 40]], '#0b6e3a', '#fff'),
  signTex([['I-99 WEST', 70], ['DESERT ROAD', 40]], '#0b6e3a', '#fff'),
].map((t) => new THREE.MeshLambertMaterial({ map: t }));
function makeGantry() {
  const g = new THREE.Group();
  for (const x of [-12.6, 12.6]) box(g, 0.45, 7.8, 0.45, 0x8a8f99, x, 3.9, 0);
  box(g, 25.6, 0.5, 0.5, 0x8a8f99, 0, 7.6, 0);
  box(g, 25.6, 0.25, 0.25, 0x8a8f99, 0, 6.9, 0);
  for (const [x, rot] of [[4, 0], [-4, Math.PI]]) {
    const s = new THREE.Group(); s.position.set(x, 7.3, 0); s.rotation.y = rot; g.add(s);
    box(s, 6.6, 3.0, 0.2, 0xdddddd, 0, 0, 0);
    const f = new THREE.Mesh(PLANE, pick(GANTRY_SIGNS)); f.scale.set(6.4, 2.8, 1); f.position.z = 0.11; s.add(f);
  }
  return g;
}
const turbines = [];
function makeTurbine() {
  const g = new THREE.Group(), h = rand(45, 65);
  const tower = new THREE.Mesh(TOWER, mat(0xf2f2f2)); tower.scale.set(1, h, 1); tower.position.y = h / 2; g.add(tower);
  box(g, 1.6, 1.6, 4, 0xe8e8e8, 0, h, 0);
  const rotor = new THREE.Group(); rotor.position.set(0, h, 2.1); g.add(rotor);
  for (let i = 0; i < 3; i++) { const b = box(rotor, 0.9, h * 0.42, 0.25, 0xffffff, 0, h * 0.21, 0); const arm = new THREE.Group(); arm.rotation.z = (i * Math.PI * 2) / 3; arm.add(b); rotor.add(arm); }
  rotor.rotation.z = rand(0, 6); turbines.push({ rotor, spd: rand(0.8, 1.4) });
  return g;
}
const fieldTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(0,0,0,.22)';
  for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
function makeField() {
  const m = new THREE.Mesh(PLANE, new THREE.MeshLambertMaterial({
    color: pick([0xd9b44a, 0x9cbf4f, 0x7a5a3a, 0xb59ad6, 0xc7d36f, 0x6fa84a]), map: fieldTex.clone(),
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
  }));
  m.material.map.needsUpdate = true;
  m.rotation.x = -Math.PI / 2; const w = rand(50, 120), l = rand(80, 200);
  m.scale.set(w, l, 1); m.material.map.repeat.set(w / 5, 1); m.userData.w = w;
  return m;
}

for (let i = 0; i < 16; i++) prop(makeHouse(), (g, z) => { const s = side(); g.position.set(s * rand(30, 90), 0, z); g.rotation.y = (s > 0 ? Math.PI : 0) + rand(-0.3, 0.3); });
for (let i = 0; i < 4; i++) prop(makeFarm(), (g, z) => { const s = side(); g.position.set(s * rand(60, 130), 0, z); g.rotation.y = (s > 0 ? Math.PI : 0) + rand(-0.4, 0.4); });
for (let i = 0; i < 6; i++) prop(makeBillboard(), (g, z) => { const s = side(); g.position.set(s * rand(19, 26), 0, z); g.rotation.y = -s * 0.45; });
for (let i = 0; i < 2; i++) prop(makeGantry(), (g, z) => { g.position.set(0, 0, z); });
for (let i = 0; i < 7; i++) prop(makeTurbine(), (g, z) => { const s = side(); g.position.set(s * rand(140, 320), 0, z); g.rotation.y = rand(-0.4, 0.4); }, 200);
for (let i = 0; i < 18; i++) prop(makeField(), (m, z) => { const s = side(); m.position.set(s * (36 + m.userData.w / 2 + rand(0, 80)), 0.01, z); }, 150);
for (let i = 0; i < 12; i++) {
  const hill = new THREE.Mesh(SPHERE, mat(pick([0x6e8a45, 0x7d9a50, 0x5f7d3e, 0x8a9a55])));
  hill.scale.set(rand(160, 400), rand(30, 80), rand(200, 500));
  prop(hill, (m, z) => { m.position.set(side() * rand(260, 600), -8, z); }, 400);
}

// instanced bushes, rocks and wildflowers (cheap, lots of them)
const scatters = [];
function scatter(geo, colors, count, xr, size, yk) {
  const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), count);
  im.frustumCulled = false; const zs = new Float32Array(count); const col = new THREE.Color();
  const set = (i) => {
    const s = rand(size[0], size[1]);
    q4.setFromAxisAngle(yAxis, rand(0, 6.28));
    m4.compose(new V3(side() * rand(xr[0], xr[1]), s * yk, zs[i]), q4, new V3(s * rand(0.8, 1.5), s * rand(0.7, 1), s * rand(0.8, 1.5)));
    im.setMatrixAt(i, m4); im.setColorAt(i, col.set(pick(colors)));
  };
  for (let i = 0; i < count; i++) { zs[i] = -Math.random() * SPAN; set(i); }
  scene.add(im); scatters.push({ im, zs, set });
}
scatter(SPHERE, [0x4f7a3a, 0x3d6b35, 0x5d8a3f, 0x6b8e3d, 0x2f5a35], 220, [13.8, 45], [0.9, 2.6], 0.3);
scatter(ROCK, [0x8d8d8d, 0x7a7068, 0xa39e93], 70, [14, 70], [0.6, 2.2], 0.25);
scatter(BOX, [0xffd166, 0xffffff, 0xef476f, 0xb5179e, 0xf8f9fa], 260, [13.5, 30], [0.12, 0.22], 0.5);

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
function sfxHit(pw = 1) {
  if (!ac) return; const t = ac.currentTime;
  const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
  og.gain.setValueAtTime(0.7 * pw, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(og); og.connect(ac.destination); o.start(t); o.stop(t + 0.32);
  const n = ac.createBufferSource(); n.buffer = noiseBuf(0.3);
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
  const g = ac.createGain(); g.gain.setValueAtTime(0.35 * pw, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  n.connect(f); f.connect(g); g.connect(ac.destination); n.start(t);
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

let keySteer = 0;
function readSteer(dt) {
  let k = 0;
  if (keys.ArrowLeft || keys.KeyA) k -= 1;
  if (keys.ArrowRight || keys.KeyD) k += 1;
  keySteer += (k - keySteer) * Math.min(1, dt * (k === 0 ? 8 : 3.7)); // keys ease in instead of snapping
  let s = Math.abs(keySteer) > 0.02 ? keySteer : 0;
  if (s === 0 && tiltRaw != null) {
    let d = tiltRaw - tiltZero;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    d = Math.abs(d) < 2.5 ? 0 : d - Math.sign(d) * 2.5;
    s = clamp(d / 30.5, -1, 1); // 5% more sensitive than the original 32° full lock
    s = Math.sign(s) * Math.abs(s) ** 1.4; // gentle near center, full lock at ~33°
  } else if (s === 0 && tiltRaw == null && touching) {
    s = touchX < innerWidth / 2 ? -1 : 1; // no gyro: touch halves steer
  }
  return s;
}
const boosting = () => keys.ArrowUp || keys.KeyW || keys.Space || (tiltRaw != null && touching > 0);
const braking = () => keys.ArrowDown || keys.KeyS;

// ---------- game state ----------
let state = 'menu', overReady = false;
const P = { x: 2, vx: 0, z: 0, speed: 30, car: null, hp: 100, yawKick: 0, yawVel: 0 };
let hitCooldown = 0, scrapeCooldown = 0;
let traffic = [], parts = [];
let score = 0, dist = 0, topSpeed = 0, nearMisses = 0, spawnAcc = 0, impactKmh = 0;
let crashT = 0, timeScale = 1, shake = 0, camOrbit = 0, crashFocus = new V3(), playerBody = null;
let best = 0; try { best = +localStorage.getItem('redline-best') || 0; } catch { }
let wreckCause = '', shoves = 0;
const NAMES = { car: 'car', suv: 'SUV', van: 'van', truck: 'truck', bus: 'bus' };
const an = (k) => (/^[aeiouAEIOS]/.test(NAMES[k] || '') ? 'an ' : 'a ') + (NAMES[k] || 'car');
function showMenuBest() { if (best > 0) { $('menuBest').textContent = best.toLocaleString(); $('menuBestWrap').classList.remove('hidden'); } }
showMenuBest();
const camPos = new V3(), camLook = new V3();

function newPlayer() {
  if (P.car) scene.remove(P.car.group);
  P.car = BUILD.player(); scene.add(P.car.group);
}
newPlayer();

const LANES_FWD = [2, 6], LANES_ONC = [-6, -2];
// rough masses in tonnes; they decide who gets shoved and how hard a hit is
const MASS = { player: 1.4, car: 1.4, suv: 2.1, van: 2.4, truck: 9, bus: 11, moto: 0.3, bike: 0.1 };
const CRASH_CLOSING = 22; // m/s (~80 km/h) of nose/tail closing speed = full wreck (less for heavy vehicles)
function spawnVehicle(x, z, vz, kind) {
  const b = BUILD[kind]();
  if (vz > 0) b.group.rotation.y = Math.PI;
  b.group.position.set(x, 0, z); scene.add(b.group);
  traffic.push({ ...b, x, lane: x, vx: 0, vz, cruise: vz, yaw: 0, yawVel: 0, disabled: false, baseRot: vz > 0 ? Math.PI : 0,
    m: MASS[kind], kind, passed: false, phase: rand(0, 6) });
}
function spawnRow(diff) {
  const z = P.z - 560;
  const lanes = [...LANES_ONC, ...LANES_FWD].sort(() => Math.random() - 0.5);
  let n = 1 + (Math.random() < 0.25 + diff * 0.45 ? 1 : 0) + (diff > 0.6 && Math.random() < 0.25 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const x = lanes[i], onc = x < 0;
    if (traffic.some((t) => Math.abs(t.x - x) < 1 && Math.abs(t.group.position.z - z) < 22)) continue;
    const r = Math.random();
    const kind = r < 0.44 ? 'car' : r < 0.56 ? 'suv' : r < 0.65 ? 'van' : r < 0.75 ? 'truck' : r < 0.83 ? 'bus' : 'moto';
    const base = kind === 'truck' || kind === 'bus' ? rand(17, 22) : kind === 'moto' ? rand(26, 34) : rand(20, 30);
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
  $('flash').style.opacity = 0;
  wreckCause = ''; shoves = 0;
  P.hp = 100; P.yawKick = 0; P.yawVel = 0; hitCooldown = 0; keySteer = 0;
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

function updateHpBar() {
  const f = $('hpFill'); const h = Math.max(0, P.hp);
  f.style.width = h + '%'; f.style.background = h > 60 ? '#4ade80' : h > 30 ? '#ffd166' : '#ff3b2f';
  $('hpChip').classList.toggle('low', h <= 30);
}
function popup(text, hot) {
  const d = document.createElement('div'); d.className = 'pop' + (hot ? ' hot' : ''); d.textContent = text;
  $('pops').appendChild(d); setTimeout(() => d.remove(), 900);
}

// ---------- crash ----------
function explode(group, vSelf, vOther, rel, mix, isPlayer) {
  group.updateMatrixWorld(true);
  const center = group.position.clone();
  const children = [...group.children];
  const list = [];
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
    parts.push(p); list.push(p);
  }
  scene.remove(group);
  return list;
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
function knockAway(t) {
  const pv = new V3(P.vx, 0, -P.speed), ov = new V3(0, 0, t.vz), rel = pv.distanceTo(ov);
  const s = Math.sign(t.group.position.x - P.x) || side();
  const at = t.group.position.clone(); at.y = 0.9;
  for (const p of explode(t.group, ov, pv, rel * 0.45, 0.8, false)) p.v.x += s * rand(5, 14);
  debris(at, pv.clone().multiplyScalar(0.7), [t.color, 0x222222], 10, 15);
  for (let i = 0; i < 50; i++) spark(at, pv.clone().multiplyScalar(0.5), 8);
  P.speed *= t.kind === 'moto' ? 0.93 : 0.97; shake = Math.max(shake, 0.6);
  P.yawVel += -s * 1.5;
  scratchCar(s);
  popup(t.kind === 'moto' ? 'BIKER DOWN!' : 'CYCLIST DOWN!', true); sfxHit(0.8); navigator.vibrate?.(60);
  wreckCause = t.kind === 'moto' ? 'Totalled after hitting a biker' : 'Totalled after hitting a cyclist';
  damage(rel * (t.kind === 'moto' ? 0.12 : 0.04), null);
}
function scratchCar(s) {
  const g = P.car.group;
  for (let i = 0; i < 4; i++) {
    const c = pick([0x2a2a2a, 0x5a5a5a, 0xbdbdbd]);
    if (Math.random() < 0.5) box(g, rand(0.2, 0.7), 0.025, 0.02, c, rand(-0.8, 0.8), rand(0.38, 0.55), -3.115).rotation.z = rand(-0.4, 0.4);
    else box(g, 0.02, 0.025, rand(0.4, 1.4), c, s * 0.99, rand(0.4, 0.75), rand(-2.1, 1.8)).rotation.x = rand(-0.3, 0.3);
  }
}
function crashSolo() {
  wreckCause = wreckCause || 'Your car gave out';
  const ghost = { group: new THREE.Group(), vz: -P.speed * 0.7, kind: 'car', color: 0x333333 };
  ghost.group.position.set(P.x, 0, P.z - 2); scene.add(ghost.group); traffic.push(ghost);
  crash(ghost);
}
function crash(other) {
  if (!wreckCause) wreckCause = other.vz > 0 ? 'Head-on with ' + an(other.kind) : 'Rear-ended ' + an(other.kind);
  state = 'crash'; crashT = 0; camOrbit = 0;
  const pv = new V3(P.vx, 0, -P.speed);
  const ov = new V3(0, 0, other.vz);
  const rel = pv.distanceTo(ov);
  impactKmh = Math.round(rel * 3.6);
  const at = P.car.group.position.clone().lerp(other.group.position, 0.5); at.y = 0.8;
  playerBody = explode(P.car.group, pv, ov, rel, other.kind === 'bike' ? 0.1 : other.kind === 'truck' || other.kind === 'bus' ? 0.75 : 0.5, true)[0];
  explode(other.group, ov, pv, rel, other.kind === 'truck' || other.kind === 'bus' ? 0.3 : 0.65, false);
  if (traffic.includes(other)) traffic.splice(traffic.indexOf(other), 1);
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
  $('oNear').textContent = nearMisses; $('oShoves').textContent = shoves;
  $('cause').innerHTML = `${wreckCause}<small>${impactKmh} km/h impact</small>`;
  showMenuBest();
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
  // after nitro the car coasts down very gradually; only the brake slows it quickly
  const rate = target > P.speed ? 0.9 : braking() ? 2.5 : 0.1;
  P.speed += (target - P.speed) * Math.min(1, dt * rate);
  const steer = readSteer(dt);
  const maxLat = 11 + P.speed * 0.06;
  P.vx += (steer * maxLat - P.vx) * Math.min(1, dt * 5);
  P.x += P.vx * dt;
  const lim = RAIL_X - 1.1;
  if (Math.abs(P.x) > lim) { // grinding the guard rail
    if (Math.abs(P.vx) > 4 && scrapeCooldown <= 0) {
      wreckCause = 'Wrecked on the guard rail'; damage(Math.abs(P.vx) * 0.6, null); sfxHit(0.4); scrapeCooldown = 0.4; }
    P.x = Math.sign(P.x) * lim; P.vx = 0; P.speed *= 1 - 0.5 * dt; shake = Math.max(shake, 0.25);
    const sp = new V3(P.x + Math.sign(P.x) * 1, 0.6, P.z + rand(-1.5, 1.5));
    for (let i = 0; i < 3; i++) spark(sp, new V3(0, 1, -P.speed * 0.6), 4);
  }
  P.z -= P.speed * dt; dist += P.speed * dt;
  topSpeed = Math.max(topSpeed, P.speed);
  const oncoming = P.x < -0.5;
  score += P.speed * dt * (oncoming ? 2 : 1);
  $('multTag').classList.toggle('on', oncoming);
  $('nitroTag').classList.toggle('on', boosting());

  const g = P.car.group;
  g.position.set(P.x, 0, P.z);
  P.yawVel += (-P.yawKick * 60 - P.yawVel * 9) * dt; P.yawKick += P.yawVel * dt; // impact wobble springs back
  g.rotation.y = -P.vx * 0.022 + P.yawKick; g.rotation.z = P.vx * 0.008;
  P.hp = Math.min(100, P.hp + dt * 0.8); // slow self-repair
  if (P.hp < 45 && Math.random() < (45 - P.hp) / 45 * 0.6) { // damaged engine smokes, then burns
    const p = g.localToWorld(new V3(rand(-0.4, 0.4), 0.9, -2.4));
    puff(p, P.hp < 20 && Math.random() < 0.4);
  }
  hitCooldown -= dt; scrapeCooldown -= dt;

  spawnAcc += P.speed * dt;
  const gap = 78 - diff * 46;
  if (spawnAcc > gap) { spawnAcc = 0; spawnRow(diff); }

  if (eng) {
    eng.o1.frequency.setTargetAtTime(55 + P.speed * 1.5, ac.currentTime, 0.05);
    eng.o2.frequency.setTargetAtTime(55 + P.speed * 1.5, ac.currentTime, 0.05);
    eng.f.frequency.setTargetAtTime(350 + P.speed * 14 + (boosting() ? 900 : 0), ac.currentTime, 0.05);
  }
}

function damage(amount, other) {
  P.hp -= amount;
  updateHpBar();
  if (P.hp <= 0 && state === 'play') { P.hp = 0; if (other) crash(other); else crashSolo(); return true; }
  return false;
}
function hitText(text, hot) { if (hitCooldown <= 0) { popup(text, hot); hitCooldown = 0.7; } }

// Contact between the player and a car/van/truck/bus. Returns true if it ended the run.
function contact(t, rx, rz, ox, oz, dt) {
  const m1 = MASS.player, m2 = t.m, mt = m1 + m2;
  const n = Math.sign(rx) || 1;                     // which side the other car is on
  const vrx = P.vx - t.vx, vrz = t.vz + P.speed;   // relative velocities (other vs player, z)
  // which axis did we enter last? that's the face we touched
  const tx = ox / Math.max(Math.abs(vrx), 0.01), tz = oz / Math.max(Math.abs(vrz), 0.01);
  const fwdOther = -t.vz;                          // other car's speed in our driving direction
  const at = new V3(P.x + rx / 2, 0.8, P.z + rz / 2);

  if (tx < tz) {
    wreckCause = (t.vz > 0 ? 'Sideswiped an oncoming ' : 'Sideswiped ' + (an(t.kind).startsWith('an') ? 'an ' : 'a ')) + NAMES[t.kind];
    // ---- SIDE CONTACT: shove each other sideways and scrape along ----
    const closing = vrx * n;
    if (closing > 0) {
      const j = (1.3 * closing) / (1 / m1 + 1 / m2);
      P.vx -= (j / m1) * n; t.vx += (j / m2) * n;
      t.yawVel += n * (j / m2) * 0.12 * (Math.random() < 0.5 ? 1 : -1);
      P.yawVel -= n * (j / m1) * 0.25;
      if (closing > 3) { sfxHit(clamp(closing / 15, 0.3, 1)); shake = Math.max(shake, clamp(closing / 15, 0.2, 0.8)); scratchCar(n); }
      if (closing > 12 && m2 < 4) t.disabled = true; // hit hard enough to spin them out
      // leaning on a car is free; only a real sideways impact costs health
      if (closing > 4 && damage((closing - 4) * 1.2 * clamp(m2 / m1, 0.7, 1.6), t)) return true;
    }
    // positional push: heavy vehicles barely move, light ones get pushed around
    P.x -= ox * (m2 / mt) * n; t.x += ox * (m1 / mt) * n;
    // scraping friction pulls the two speeds together
    const dv = P.speed - fwdOther, k = Math.min(1, dt * 1.8);
    P.speed -= dv * k * (m2 / mt); t.vz -= dv * k * (m1 / mt);
    if (Math.abs(dv) > 40) { // side-scraping an oncoming car at huge closing speed
      t.disabled = true; t.yawVel += rand(2, 4) * (Math.random() < 0.5 ? 1 : -1);
      P.yawVel -= n * 3;
      if (damage(Math.abs(dv) * dt * 6, t)) return true;
      hitText('MIRROR SMASH!', true);
    } else if (Math.abs(dv) > 2) {
      if (Math.abs(dv) > 8 && damage(Math.abs(dv) * dt * 0.6, t)) return true;
      hitText(closing > 6 ? 'SHOVE!' : 'SIDESWIPE', false);
    } else if (closing > 2) hitText('SHOVE!', false);
    if (Math.random() < 0.6) for (let i = 0; i < 4; i++) spark(at, new V3(0, 1, -P.speed * 0.5), 5);
    return false;
  }

  // ---- NOSE / TAIL CONTACT ----
  const closing = vrz * -Math.sign(rz);            // >0 when the gap was shrinking
  const s = -Math.sign(rz);                          // +1: other is ahead of us
  if (closing > 0) {
    const heavy = Math.sqrt(clamp(m2 / m1, 1, 3.2)); // trucks/buses wreck you at lower speed
    const glancing = ox < 0.5;                        // only the corners touched
    wreckCause = glancing && t.vz > 0 ? 'Clipped an oncoming ' + NAMES[t.kind] : t.vz > 0 ? 'Head-on with ' + an(t.kind) : s > 0 ? 'Rear-ended ' + an(t.kind) : 'Hit from behind by ' + an(t.kind);
    if (!glancing && closing >= CRASH_CLOSING / heavy) { crash(t); return true; }
    if (glancing && closing >= CRASH_CLOSING / heavy) {
      // clipped a corner at speed: violent, but you might ride it out
      t.disabled = true; t.yawVel += n * rand(3, 6); t.vx += n * rand(4, 8);
      P.vx -= n * rand(5, 9); P.yawVel -= n * 4; P.speed *= 0.8;
      for (let i = 0; i < 60; i++) spark(at, new V3(0, 2, -P.speed * 0.5), 10);
      debris(at, new V3(0, 0, -P.speed * 0.7), [t.color, P.car.color, 0x222222], 12, 30);
      sfxHit(1); shake = 1; scratchCar(n); navigator.vibrate?.(120);
      if (damage(18 + closing * 0.3, t)) return true;
      hitText('CLIPPED IT!', true);
      return false;
    }
    // survivable bump: 1-D collision with a bit of bounce, momentum depends on mass
    const u1 = P.speed, u2 = fwdOther, e = 0.25, p = m1 * u1 + m2 * u2;
    const v1 = (p - m2 * e * (u1 - u2)) / mt, v2 = (p + m1 * e * (u1 - u2)) / mt;
    P.speed = Math.max(8, v1); t.vz = -v2;
    const hard = closing > 11;
    if (hard) { t.yawVel += rand(-1, 1) * closing * 0.12; if (closing > 16 && m2 < 4) t.disabled = true; P.yawVel += rand(-1, 1) * 2; }
    sfxHit(clamp(closing / 20, 0.25, 1)); shake = Math.max(shake, clamp(closing / 18, 0.25, 1));
    for (let i = 0; i < closing * 2; i++) spark(at, new V3(0, 1, -P.speed * 0.6), 4);
    if (hard) { scratchCar(n); debris(at, new V3(0, 0, -P.speed), [t.color, 0x222222], 6, 10); navigator.vibrate?.(80); }
    if (closing > 3 && damage((closing - 3) * 1.5 * clamp(m2 / m1, 0.7, 1.8), t)) return true;
    hitText(s > 0 ? (hard ? 'SLAMMED!' : 'BUMP') : 'REAR-ENDED!', hard);
  }
  // separate along z (mass-weighted)
  P.z += oz * (m2 / mt) * s; t.group.position.z -= oz * (m1 / mt) * s;
  return false;
}

function updateTraffic(dt) {
  for (let i = traffic.length - 1; i >= 0; i--) {
    const t = traffic[i];
    if (state !== 'play') t.vz *= Math.exp(-1.2 * dt); // everyone hits the brakes after a crash
    // driver AI: return to cruise speed and lane after being bumped; spun-out cars just slide to a stop
    if (t.disabled) {
      t.vz *= Math.exp(-0.9 * dt); t.vx *= Math.exp(-1.5 * dt); t.yawVel *= Math.exp(-1.2 * dt);
    } else {
      t.vz += (t.cruise - t.vz) * Math.min(1, dt * 0.35);
      t.vx += ((t.lane - t.x) * 1.6 - t.vx) * Math.min(1, dt * 2.5);
      t.yawVel += (-t.yaw * 12 - t.yawVel * 5) * dt;
    }
    t.x += t.vx * dt; t.yaw += t.yawVel * dt;
    const lim = RAIL_X - t.w / 2 - 0.1;
    if (Math.abs(t.x) > lim) { t.x = Math.sign(t.x) * lim; t.vx *= -0.3; }
    t.group.position.z += t.vz * dt;
    t.group.position.x = t.x; t.group.rotation.y = t.baseRot + t.yaw;
    if (t.kind === 'bike' || t.kind === 'moto') { t.phase += dt * 3; t.group.position.x = t.x + Math.sin(t.phase) * 0.12; t.group.rotation.z = Math.sin(t.phase) * 0.05; }
    const z = t.group.position.z;
    if (z > P.z + 40 || z < P.z - 1100) { scene.remove(t.group); traffic.splice(i, 1); continue; }
    if (state !== 'play') continue;
    // collision (boxes slightly smaller than the bodies so near misses feel fair)
    const rx = t.group.position.x - P.x, rz = z - P.z;
    const hw = (t.w + P.car.w) * 0.46, hl = (t.l + P.car.l) * 0.46;
    if (Math.abs(rx) < hw && Math.abs(rz) < hl) {
      if (t.kind === 'bike' || t.kind === 'moto') { traffic.splice(i, 1); knockAway(t); continue; }
      if (contact(t, rx, rz, hw - Math.abs(rx), hl - Math.abs(rz), dt)) return;
      if (!t.touched) shoves++;
      t.touched = true;
      continue;
    }
    // near miss (only if we didn't touch it)
    if (!t.passed && z > P.z + t.l / 2) {
      t.passed = true;
      const gapX = Math.abs(rx) - (t.w + P.car.w) / 2;
      if (gapX < 1.1 && !t.touched) {
        nearMisses++; const bonus = t.vz > 0 ? 500 : 250; score += bonus;
        popup(`NEAR MISS +${bonus}`, t.vz > 0); sfxWhoosh(); shake = Math.max(shake, 0.25);
      }
    }
  }
  // traffic queues behind slower (or wrecked) vehicles in its lane instead of driving through them
  for (const a of traffic) for (const b of traffic) {
    if (a === b || a.disabled || !a.cruise || Math.abs(a.x - b.x) > 1.8) continue;
    const dir = Math.sign(a.cruise);
    if (!b.disabled && Math.sign(b.vz) !== dir) continue;
    const ahead = (b.group.position.z - a.group.position.z) * dir;
    if (ahead > 0 && ahead < (a.l + b.l) / 2 + 10) {
      const limit = b.disabled ? 0 : Math.abs(b.vz); // stop behind a wreck
      if (Math.abs(a.vz) > limit) a.vz = dir * limit;
    }
  }
}

const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (state === 'play' && p.obj.position.z > P.z + 80) { scene.remove(p.obj); parts.splice(i, 1); continue; }
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

function updateScenery(dt) {
  for (const t of turbines) t.rotor.rotation.z -= t.spd * dt;
  const pz = P.z;
  roadGroup.position.z = Math.round(pz / 72) * 72 - 450; // 72 m = common period of road paint, posts, fences, power poles
  ground.position.set(P.x, -0.05, pz);
  far.position.set(0, 0, pz);
  for (const l of lamps) if (l.position.z > pz + 30) l.position.z -= SPAN;
  for (const t of trees) if (t.position.z > pz + 30) placeTree(t, t.position.z - SPAN);
  for (const p of props) if (p.obj.position.z > pz + p.margin) p.place(p.obj, p.obj.position.z - SPAN);
  for (const sc of scatters) {
    let dirty = false;
    for (let i = 0; i < sc.zs.length; i++) if (sc.zs[i] > pz + 30) { sc.zs[i] -= SPAN; sc.set(i); dirty = true; }
    if (dirty) { sc.im.instanceMatrix.needsUpdate = true; sc.im.instanceColor.needsUpdate = true; }
  }
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
    // the wreck burns
    if (playerBody && Math.random() < 0.5 * (dt / 0.016)) {
      const p = playerBody.obj.position.clone().add(new V3(rand(-0.6, 0.6), 0.4, rand(-0.6, 0.6)));
      puff(p, Math.random() < 0.45);
    }
  }
  updateParts(dt);
  updateParticles(dt);
  updateScenery(dt);
  updateCamera(rdt, dt);

  hudT -= rdt;
  if (state === 'play' && hudT <= 0) {
    hudT = 0.08;
    $('speed').textContent = Math.round(P.speed * 3.6);
    $('speedFill').style.width = clamp(P.speed * 3.6 / 400, 0, 1) * 100 + '%';
    $('scoreV').textContent = Math.floor(score).toLocaleString();
    $('distV').textContent = (dist / 1000).toFixed(1) + ' km';
    updateHpBar();
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend(); else ac.resume();
});

// debug hook for automated testing
window.__game = { P, contact, get state() { return state; }, get traffic() { return traffic; }, startRun, crash, tick, keys, spawnVehicle };
