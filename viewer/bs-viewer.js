// Minimal 3D viewer for a Brighter Shores creature.
//
// Loads a single .glb model (mesh + skeleton + looping idle animation + texture,
// all baked into one file by build/bake_glb.mjs) with three.js's standard
// GLTFLoader, and shows it with orbit + zoom controls on a transparent
// background. No custom shaders, no custom decoding — just load, play, orbit.
//
// The model is authored Z-up (Brighter Shores convention), so the camera is too.

import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e; };

// Switch the model to a glTF material variant (KHR_materials_variants), chosen by
// 0-based index (e.g. "0") or by name.
async function selectVariant(gltf, root, variant) {
  const parser = gltf.parser;
  const names = (parser.json.extensions?.KHR_materials_variants?.variants || []).map((v) => v.name);
  const index = /^\d+$/.test(String(variant)) ? Number(variant) : names.indexOf(variant);
  if (index < 0 || index >= names.length) return;
  const jobs = [];
  root.traverse((o) => {
    const ext = o.isMesh && o.userData.gltfExtensions && o.userData.gltfExtensions.KHR_materials_variants;
    const mapping = ext && ext.mappings.find((m) => m.variants.includes(index));
    if (mapping) jobs.push(parser.getDependency('material', mapping.material).then((mat) => { mat.side = THREE.DoubleSide; o.material = mat; }));
  });
  await Promise.all(jobs);
}

// Mount the viewer into `host`, loading the .glb at `opts.src`. Returns { stop }.
export async function createViewer(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // alpha -> transparent background
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 1e5);
  camera.up.set(0, 0, 1); // Z-up
  scene.add(new THREE.HemisphereLight(0xdfe7f5, 0x40382e, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  scene.add(key);

  const gltf = await new GLTFLoader().loadAsync(opts.src);
  const model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material.side = THREE.DoubleSide; } });
  if (opts.variant) await selectVariant(gltf, model, opts.variant); // pick the skin
  scene.add(model);

  const controls = new OrbitControls(camera, renderer.domElement); // drag = orbit, wheel/pinch = zoom
  controls.enableDamping = true;
  controls.enablePan = false;

  const mixer = new THREE.AnimationMixer(model);
  const actions = gltf.animations.map((a) => mixer.clipAction(a));

  // frame over the FULL range of motion: bind-pose mesh box + bone positions
  // sampled across every clip, so switching animations never clips the model.
  const bones = [];
  model.traverse((o) => { if (o.isBone) bones.push(o); });
  const box = new THREE.Box3();
  model.updateMatrixWorld(true); box.setFromObject(model);
  const wp = new THREE.Vector3();
  for (const a of actions) {
    a.play();
    for (let seg = 0; seg <= 2; seg++) { a.time = (a.getClip().duration * seg) / 2; mixer.update(0); model.updateMatrixWorld(true); for (const b of bones) { b.getWorldPosition(wp); box.expandByPoint(wp); } }
    a.stop();
  }
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(1e-3, box.getSize(new THREE.Vector3()).length() / 2);
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2)) * 0.95;
  camera.position.copy(centre).addScaledVector(new THREE.Vector3(-0.4, 0.85, 0.3).normalize(), dist);
  camera.far = dist * 4; camera.updateProjectionMatrix();
  controls.target.copy(centre);
  key.position.copy(centre).add(new THREE.Vector3(-radius, radius * 2, radius * 3));

  // --- animation controls (‹ play/pause ›) at the bottom ---
  let cur = 0, paused = false;
  const bar = el('div', 'position:absolute;left:0;right:0;bottom:0;display:flex;gap:6px;align-items:center;justify-content:center;padding:6px;pointer-events:none');
  const btn = (t) => el('button', 'pointer-events:auto;cursor:pointer;min-width:26px;background:rgba(18,20,26,.82);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:4px 8px;font:600 13px sans-serif', t);
  const prevB = btn('‹'), playB = btn('❚❚'), nextB = btn('›');
  const label = el('span', 'min-width:42px;text-align:center;color:#fff;font:600 12px sans-serif;text-shadow:0 1px 2px #000');
  if (actions.length > 1) bar.append(prevB, playB, label, nextB);
  else if (actions.length === 1) bar.append(playB);
  host.appendChild(bar);
  function show(i) {
    if (!actions.length) return;
    actions[cur].stop();
    cur = (i + actions.length) % actions.length;
    const a = actions[cur]; a.reset(); a.paused = paused; a.play();
    label.textContent = `${cur + 1} / ${actions.length}`;
  }
  prevB.onclick = () => show(cur - 1);
  nextB.onclick = () => show(cur + 1);
  playB.onclick = () => { paused = !paused; if (actions[cur]) actions[cur].paused = paused; playB.textContent = paused ? '▶' : '❚❚'; };
  show(0);   // idle first (animations[0])

  // brief drag/zoom hint above the controls
  const hint = el('div', 'position:absolute;left:0;right:0;bottom:36px;text-align:center;pointer-events:none;color:#fff;font:600 11px sans-serif;text-shadow:0 1px 3px #000;transition:opacity .7s',
    matchMedia('(pointer:coarse)').matches ? 'drag to rotate · pinch to zoom' : 'drag to rotate · scroll to zoom');
  host.appendChild(hint);
  setTimeout(() => { hint.style.opacity = '0'; }, 3500);

  const resize = () => {
    const w = host.clientWidth || 300, h = host.clientHeight || 270;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host); resize();

  const clock = new THREE.Clock();
  let running = true;
  (function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    mixer.update(clock.getDelta());
    controls.update();
    renderer.render(scene, camera);
  })();

  return { stop() { running = false; controls.dispose(); renderer.dispose(); renderer.domElement.remove(); bar.remove(); hint.remove(); } };
}
