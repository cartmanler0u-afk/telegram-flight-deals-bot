// Personnages low-poly animés (marche, assis, frappe au clavier, discussion).

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const matCache = new Map();
export function mat(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.04, ...extra }));
  }
  return matCache.get(key);
}

const GEO = {
  thigh: new THREE.CapsuleGeometry(0.085, 0.24, 4, 10),
  shin: new THREE.CapsuleGeometry(0.075, 0.24, 4, 10),
  shoe: new THREE.BoxGeometry(0.14, 0.08, 0.25),
  torso: new THREE.CapsuleGeometry(0.21, 0.32, 6, 14),
  neck: new THREE.CylinderGeometry(0.07, 0.08, 0.14, 10),
  arm: new THREE.CapsuleGeometry(0.06, 0.36, 4, 10),
  hand: new THREE.SphereGeometry(0.062, 10, 8),
  head: new THREE.SphereGeometry(0.2, 22, 16),
  eye: new THREE.SphereGeometry(0.024, 8, 6),
  hairCap: new THREE.SphereGeometry(0.214, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  hairBack: new THREE.BoxGeometry(0.36, 0.34, 0.12),
  bun: new THREE.SphereGeometry(0.09, 12, 10),
  curl: new THREE.SphereGeometry(0.07, 8, 6),
  spike: new THREE.ConeGeometry(0.05, 0.14, 6),
  hitbox: new THREE.CylinderGeometry(0.45, 0.45, 2, 8),
  ring: new THREE.TorusGeometry(0.42, 0.035, 8, 40),
};

const BLACK = mat("#1a1a22");
const WHITE = mat("#f5f5f5");
const HIT = new THREE.MeshBasicMaterial({ visible: false });

function mesh(geo, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function buildHair(head, look) {
  const hairMat = mat(look.hair || "#2a2a2a");
  const style = look.hairStyle || "short";
  if (style === "bald") return;
  const cap = mesh(GEO.hairCap, hairMat, head, 0, 0.17, -0.01);
  cap.rotation.x = -0.55;
  if (style === "long") {
    mesh(GEO.hairBack, hairMat, head, 0, 0.05, -0.12);
  } else if (style === "bun") {
    mesh(GEO.bun, hairMat, head, 0, 0.36, -0.1);
  } else if (style === "curly") {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      mesh(GEO.curl, hairMat, head, Math.cos(a) * 0.17, 0.27 + Math.sin(i) * 0.03, Math.sin(a) * 0.15 - 0.03);
    }
  } else if (style === "spiky") {
    for (let i = 0; i < 6; i++) {
      const s = mesh(GEO.spike, hairMat, head, -0.12 + i * 0.05, 0.38, -0.02 + (i % 2) * 0.05);
      s.rotation.z = (i - 2.5) * 0.15;
    }
  }
}

function buildAccessory(parts, kind, look) {
  const { head, torso, handR, handL } = parts;
  switch (kind) {
    case "tie": {
      const tie = mesh(new THREE.BoxGeometry(0.07, 0.3, 0.02), mat("#c0392b"), torso, 0, 0.48, 0.19);
      tie.rotation.x = -0.12;
      break;
    }
    case "headset": {
      const band = mesh(new THREE.TorusGeometry(0.215, 0.018, 6, 20, Math.PI), BLACK, head, 0, 0.17, 0);
      band.rotation.y = Math.PI / 2;
      const mic = mesh(new THREE.BoxGeometry(0.02, 0.02, 0.16), BLACK, head, 0.17, 0.08, 0.1);
      mic.rotation.y = 0.5;
      break;
    }
    case "headphones": {
      const band = mesh(new THREE.TorusGeometry(0.225, 0.025, 6, 20, Math.PI), mat("#ff4d8d"), head, 0, 0.17, 0);
      band.rotation.y = Math.PI / 2;
      for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), mat("#ff4d8d"), head, sx * 0.21, 0.17, 0).rotation.z = Math.PI / 2;
      break;
    }
    case "glasses": {
      for (const sx of [-1, 1]) mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 14), BLACK, head, sx * 0.075, 0.19, 0.19);
      break;
    }
    case "notepad":
      mesh(new THREE.BoxGeometry(0.14, 0.02, 0.19), mat("#fff6d6"), handR, 0, -0.03, 0.06);
      break;
    case "clipboard":
      mesh(new THREE.BoxGeometry(0.17, 0.02, 0.23), mat("#a0703f"), handL, 0, -0.03, 0.08);
      break;
    case "pen":
      mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), mat("#2d6cdf"), handR, 0, 0, 0.05).rotation.x = Math.PI / 2;
      break;
    case "crown": {
      const gold = mat("#f7c948", { metalness: 0.6, roughness: 0.3, emissive: "#6b4b00", emissiveIntensity: 0.3 });
      mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.07, 14, 1, true), gold, head, 0, 0.42, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        mesh(new THREE.ConeGeometry(0.03, 0.08, 6), gold, head, Math.cos(a) * 0.125, 0.49, Math.sin(a) * 0.125);
      }
      break;
    }
    default:
  }
}

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class Person {
  constructor({ id, look, accessory = "none", isBoss = false, onClick }) {
    this.id = id;
    this.isBoss = isBoss;
    this.root = new THREE.Group();
    this.root.userData.agentId = id;
    this.body = new THREE.Group();
    this.root.add(this.body);

    const skin = mat(look.skin || "#e8b796");
    const shirt = mat(look.shirt || "#5a6bd8");
    const pants = mat(look.pants || "#2b2f3a");

    const leg = (sx) => {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.1, 0.78, 0);
      this.body.add(hip);
      mesh(GEO.thigh, pants, hip, 0, -0.19, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.38;
      hip.add(knee);
      mesh(GEO.shin, pants, knee, 0, -0.18, 0);
      mesh(GEO.shoe, BLACK, knee, 0, -0.37, 0.04);
      return { hip, knee };
    };
    this.legL = leg(-1);
    this.legR = leg(1);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.78;
    this.body.add(this.torso);
    const chest = mesh(GEO.torso, shirt, this.torso, 0, 0.34, 0);
    chest.scale.set(1, 1, 0.82);
    mesh(GEO.neck, skin, this.torso, 0, 0.74, 0);

    const arm = (sx) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * 0.28, 0.6, 0);
      this.torso.add(shoulder);
      mesh(GEO.arm, shirt, shoulder, 0, -0.23, 0);
      const hand = new THREE.Group();
      hand.position.y = -0.48;
      shoulder.add(hand);
      mesh(GEO.hand, skin, hand);
      shoulder.rotation.z = sx * 0.08;
      return { shoulder, hand };
    };
    this.armL = arm(-1);
    this.armR = arm(1);

    this.head = new THREE.Group();
    this.head.position.y = 0.8;
    this.torso.add(this.head);
    mesh(GEO.head, skin, this.head, 0, 0.17, 0);
    for (const sx of [-1, 1]) mesh(GEO.eye, BLACK, this.head, sx * 0.075, 0.19, 0.19).castShadow = false;
    buildHair(this.head, look);
    buildAccessory({ head: this.head, torso: this.torso, handR: this.armR.hand, handL: this.armL.hand }, accessory, look);
    if (isBoss) {
      buildAccessory({ head: this.head }, "crown", look);
      const ring = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: "#7fe3ff", transparent: true, opacity: 0.85 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.03;
      this.root.add(ring);
      this.ring = ring;
    }

    const hit = new THREE.Mesh(GEO.hitbox, HIT);
    hit.position.y = 1;
    hit.userData.agentId = id;
    this.root.add(hit);
    this.hitbox = hit;

    this.root.scale.setScalar(0.92);

    // Étiquette au-dessus de la tête
    this.tagEl = document.createElement("div");
    this.tagEl.className = `tag${isBoss ? " boss" : ""}`;
    this.tagEl.innerHTML = `<div class="tag-bubble" hidden></div><div class="tag-pill"><span class="emo"></span><span class="dot"></span><span class="tag-name"></span></div><div class="tag-bar" hidden><i></i></div>`;
    this.tagEl.querySelector(".dot").style.background = look.shirt || "#fff";
    if (onClick) {
      this.tagEl.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        onClick(id);
      });
    }
    this.label = new CSS2DObject(this.tagEl);
    this.label.position.set(0, 2.25, 0);
    this.root.add(this.label);
    this.bubbleTimer = null;

    this.path = [];
    this.target = null;
    this.pose = "stand";
    this.activity = "idle";
    this.phase = Math.random() * 10;
    this.speed = 2.3;
    this.heading = 0;
    this.onArrive = null;
  }

  setName(name) {
    this.tagEl.querySelector(".tag-name").textContent = name;
  }

  setStatus({ emoji = "", progress = null, compact = false } = {}) {
    this.tagEl.querySelector(".emo").textContent = emoji;
    const bar = this.tagEl.querySelector(".tag-bar");
    bar.hidden = progress === null;
    if (progress !== null) bar.firstElementChild.style.width = `${Math.round(progress * 100)}%`;
    this.tagEl.classList.toggle("compact", compact);
  }

  say(text, ms = 3500) {
    const bubble = this.tagEl.querySelector(".tag-bubble");
    bubble.textContent = text;
    bubble.hidden = false;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      bubble.hidden = true;
    }, ms);
  }

  place(spot) {
    this.root.position.set(spot.x, 0, spot.z);
    this.heading = spot.facing ?? 0;
    this.root.rotation.y = this.heading;
    this.path = [];
    this.target = spot;
    this.pose = spot.standing || spot.stand ? "stand" : "sit";
  }

  walk(path, target, onArrive = null) {
    this.path = path.slice();
    this.target = target;
    this.onArrive = onArrive;
    this.pose = "walk";
  }

  get moving() {
    return this.path.length > 0;
  }

  update(dt, t) {
    this.phase += dt;
    // Déplacement
    if (this.path.length) {
      const [tx, tz] = this.path[0];
      const p = this.root.position;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const dist = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (dist <= step) {
        p.x = tx;
        p.z = tz;
        this.path.shift();
      } else {
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 10));
      }
      if (!this.path.length) {
        this.pose = this.target && !this.target.standing && !this.target.stand ? "sit" : "stand";
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      }
    } else if (this.target && this.target.facing !== undefined) {
      this.heading = lerpAngle(this.heading, this.target.facing, Math.min(1, dt * 6));
    }
    this.root.rotation.y = this.heading;
    this.animate(t);
  }

  animate(t) {
    const { legL, legR, armL, armR, body, head, torso } = this;
    const ph = this.phase;
    let bodyY = 0;
    let thighL = 0, thighR = 0, kneeL = 0, kneeR = 0;
    let armLx = 0.05, armRx = 0.05;
    let headX = 0, headY = 0;
    let torsoX = 0;

    if (this.pose === "walk") {
      const s = Math.sin(ph * 9);
      thighL = s * 0.55;
      thighR = -s * 0.55;
      kneeL = Math.max(0, -s) * 0.7;
      kneeR = Math.max(0, s) * 0.7;
      armLx = -s * 0.45;
      armRx = s * 0.45;
      bodyY = Math.abs(Math.cos(ph * 9)) * 0.035;
    } else if (this.pose === "sit") {
      bodyY = -0.33;
      thighL = thighR = -Math.PI / 2;
      kneeL = kneeR = Math.PI / 2;
      if (this.activity === "work") {
        armLx = -1.15 + Math.sin(ph * 17) * 0.07;
        armRx = -1.15 + Math.sin(ph * 17 + 1.7) * 0.07;
        headX = 0.12 + Math.sin(ph * 0.7) * 0.03;
        torsoX = 0.08;
      } else if (this.activity === "talk") {
        armLx = -0.9;
        armRx = -0.9 + Math.max(0, Math.sin(ph * 1.3)) * -0.5;
        headX = Math.sin(ph * 2.6) * 0.07;
        headY = Math.sin(ph * 0.6) * 0.35;
      } else {
        armLx = armRx = -0.75;
        headY = Math.sin(ph * 0.4) * 0.25;
      }
    } else {
      // debout
      const breathe = Math.sin(ph * 2) * 0.01;
      bodyY = breathe;
      if (this.activity === "talk") {
        armRx = -0.6 + Math.sin(ph * 2.2) * 0.25;
        headX = Math.sin(ph * 2.6) * 0.06;
      } else if (this.activity === "coffee") {
        armRx = -1.6 + Math.sin(ph * 0.8) * 0.15;
        headY = Math.sin(ph * 0.5) * 0.3;
      } else if (this.activity === "drop") {
        armLx = armRx = -1.2;
      } else if (this.activity === "wave") {
        armRx = -2.6;
        this.armR.shoulder.rotation.z = 0.3 + Math.sin(ph * 10) * 0.35;
      }
    }

    body.position.y = bodyY;
    legL.hip.rotation.x = thighL;
    legR.hip.rotation.x = thighR;
    legL.knee.rotation.x = kneeL;
    legR.knee.rotation.x = kneeR;
    armL.shoulder.rotation.x = armLx;
    armR.shoulder.rotation.x = armRx;
    if (this.activity !== "wave" || this.pose !== "stand") armR.shoulder.rotation.z = 0.08;
    head.rotation.x = headX;
    head.rotation.y = headY;
    torso.rotation.x = torsoX;
    if (this.ring) this.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
  }

  dispose() {
    this.root.removeFromParent();
    this.label.element.remove();
    clearTimeout(this.bubbleTimer);
  }
}
