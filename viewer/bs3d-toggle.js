// Page hook for the 3D viewer. Activates only when the page declares a model —
// either the infobox's optional `model` parameter (which puts a data-model URL
// on the `.infobox-image` cell) or a standalone {{3D Model}} marker span. It
// then adds a "3D" button to the infobox image; clicking it swaps the picture
// for the interactive model (drag to rotate, scroll/pinch to zoom), "2D" back.
//
// Load this once site-wide (e.g. from Common.js or as a Gadget); it does nothing
// on pages that declare no model.

import { createViewer } from './bs-viewer.js';

const cell = document.querySelector('.infobox-image');
const src = cell?.dataset.model || document.querySelector('.foe-3d-model[data-model]')?.dataset.model;
const variant = cell?.dataset.variant;                 // which skin, if the .glb bundles several
const img = cell?.querySelector('img');
if (src && img) {                                      // URL of the uploaded .glb
  const media = img.closest('span, a') || img;         // the image + its wiki wrapper
  const slot = document.createElement('span');
  slot.style.cssText = 'position:relative;display:inline-block;line-height:0';
  media.replaceWith(slot);
  slot.appendChild(media);

  const btn = document.createElement('button');
  btn.textContent = '3D';
  btn.style.cssText = 'position:absolute;top:6px;right:6px;z-index:2;padding:7px 13px;cursor:pointer;'
    + 'font:600 12px sans-serif;color:#fff;background:rgba(18,20,26,.82);'
    + 'border:1px solid rgba(255,255,255,.3);border-radius:99px';
  slot.appendChild(btn);

  let viewer = null, host = null;
  btn.onclick = async () => {
    if (viewer) { viewer.stop(); host.remove(); viewer = null; media.style.display = ''; btn.textContent = '3D'; return; }
    const { width, height } = img.getBoundingClientRect();
    host = document.createElement('div');
    host.style.cssText = `position:relative;width:${Math.round(width)}px;height:${Math.round(height)}px`;
    slot.insertBefore(host, btn);
    media.style.display = 'none';
    btn.textContent = '2D';
    viewer = await createViewer(host, { src, variant });   // viewer adds the hint + animation controls
  };
}
