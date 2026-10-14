// Rendu "foule" : toutes les pièces identiques des personnages (têtes, bras, jambes, cheveux…)
// sont dessinées par un seul maillage instancié par type de pièce. Les personnages gardent leur
// squelette animé (Object3D invisibles) ; on recopie leurs matrices à chaque image.

import * as THREE from "three";

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const BASE_MATERIAL = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.78, metalness: 0.04 });

function batchable(material) {
  if (material.userData?.batch) return "shared";
  if (material.isMeshStandardMaterial && !material.transparent && material.metalness < 0.3 && material.emissive.getHex() === 0 && !material.map) return "tinted";
  return null;
}

export class Crowd {
  constructor(scene) {
    this.scene = scene;
    this.kinds = new Map(); // clé -> { geometry, material, tinted, parts: [{ obj, owner, color }], mesh }
    this.dirty = false;
  }

  add(owner) {
    owner.traverse((obj) => {
      if (!obj.isMesh || obj.userData.noBatch) return;
      const mode = batchable(obj.material);
      if (!mode) return;
      const key = mode === "shared" ? `${obj.geometry.uuid}|${obj.material.uuid}` : `${obj.geometry.uuid}|tinted`;
      if (!this.kinds.has(key)) this.kinds.set(key, { geometry: obj.geometry, material: mode === "shared" ? obj.material : BASE_MATERIAL, tinted: mode === "tinted", parts: [], mesh: null });
      this.kinds.get(key).parts.push({ obj, owner, color: obj.material.color.clone() });
      obj.visible = false;
    });
    this.dirty = true;
  }

  remove(owner) {
    for (const kind of this.kinds.values()) kind.parts = kind.parts.filter((p) => p.owner !== owner);
    this.dirty = true;
  }

  rebuild() {
    for (const kind of this.kinds.values()) {
      if (kind.mesh) {
        kind.mesh.removeFromParent();
        kind.mesh.dispose();
        kind.mesh = null;
      }
      if (!kind.parts.length) continue;
      const mesh = new THREE.InstancedMesh(kind.geometry, kind.material, kind.parts.length);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (kind.tinted) kind.parts.forEach((p, i) => mesh.setColorAt(i, p.color));
      if (kind.material.transparent) mesh.renderOrder = 1;
      this.scene.add(mesh);
      kind.mesh = mesh;
    }
    this.dirty = false;
  }

  update() {
    if (this.dirty) this.rebuild();
    for (const kind of this.kinds.values()) {
      const mesh = kind.mesh;
      if (!mesh) continue;
      kind.parts.forEach((p, i) => mesh.setMatrixAt(i, p.owner.visible ? p.obj.matrixWorld : HIDDEN));
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  get drawCalls() {
    return [...this.kinds.values()].filter((k) => k.mesh).length;
  }
}
