# Brighter Shores wiki — 3D model viewer prototype

A proof of concept for an opt-in **3D** button on a creature's infobox image:
tapping it swaps the static picture for an interactive model (drag to rotate,
scroll / pinch to zoom, transparent background) playing the neutral standing
animation. This mirrors the [Gray Wolf](https://brightershoreswiki.org/w/Gray_Wolf)
page.

**Live page:** https://joenye.github.io/bs-wiki-3d-prototype/

The whole model — mesh, skeleton, idle animation and every wolf skin — is one
`.glb` file (`model/wolf.glb`); the viewer is standard [three.js](https://threejs.org)
`GLTFLoader`. Skins are glTF material variants, picked by index. Model, textures
and animation are decoded from the game's asset bundles; page content & styling
© the Brighter Shores Wiki (CC BY-NC-SA).
