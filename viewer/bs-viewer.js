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

  const mixer = new THREE.AnimationMixer(model);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play(); // loop the idle

  const controls = new OrbitControls(camera, renderer.domElement); // drag = orbit, wheel/pinch = zoom
  controls.enableDamping = true;
  controls.enablePan = false;

  // frame the model from a 3/4 front view (it faces +Y) and place the key light
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2)) * 0.9;
  camera.position.copy(centre).addScaledVector(new THREE.Vector3(-0.4, 0.85, 0.3).normalize(), dist);
  camera.far = dist * 4; camera.updateProjectionMatrix();
  controls.target.copy(centre);
  key.position.copy(centre).add(new THREE.Vector3(-radius, radius * 2, radius * 3));

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

  return { stop() { running = false; controls.dispose(); renderer.dispose(); renderer.domElement.remove(); } };
}
