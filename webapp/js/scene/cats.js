// Les chats du bureau : petits modèles low-poly animés (marche, assis, sieste, jeu) et leur
// « directeur » de vie : siestes sur les claviers, poursuite des collègues, cachettes de quête…

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { mat } from "./people.js";
import { AREAS, deskTop } from "./layout.js";
import { CAT_COATS, HIDING_SPOTS } from "../../shared/social.js";

const rand = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.random() * (b - a);

const G = {
  body: new THREE.SphereGeometry(0.14, 14, 10),
  chest: new THREE.SphereGeometry(0.1, 12, 8),
  head: new THREE.SphereGeometry(0.105, 14, 10),
  muzzle: new THREE.SphereGeometry(0.05, 10, 8),
  ear: new THREE.ConeGeometry(0.042, 0.085, 4),
  eye: new THREE.SphereGeometry(0.017, 8, 6),
  nose: new THREE.SphereGeometry(0.013, 6, 4),
  leg: new THREE.CapsuleGeometry(0.027, 0.1, 3, 8),
  paw: new THREE.SphereGeometry(0.032, 8, 6),
  tail: new THREE.CylinderGeometry(0.022, 0.026, 0.13, 8),
  hit: new THREE.SphereGeometry(0.42, 8, 6),
  blob: new THREE.CircleGeometry(0.3, 16),
};
const EYE = new THREE.MeshBasicMaterial({ color: "#c7f464", toneMapped: false });
const NOSE = mat("#ff8fab");
const HIT = new THREE.MeshBasicMaterial({ visible: false });
const BLOB = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.2, depthWrite: false });

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class Cat {
  constructor({ id, name, coat, onClick }) {
    this.id = id;
    const colors = CAT_COATS[coat] || CAT_COATS.grey;
    const fur = mat(colors.body, { roughness: 0.95 });
    const light = mat(colors.belly, { roughness: 0.95 });
    this.root = new THREE.Group();
    this.root.userData.catId = id;
    this.body = new THREE.Group();
    this.root.add(this.body);

    const torso = new THREE.Mesh(G.body, fur);
    torso.scale.set(0.85, 0.75, 1.6);
    torso.position.y = 0.2;
    this.body.add(torso);
    const chest = new THREE.Mesh(G.chest, light);
    chest.scale.set(0.8, 0.85, 0.7);
    chest.position.set(0, 0.19, 0.15);
    this.body.add(chest);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.32, 0.24);
    this.body.add(this.head);
    this.head.add(new THREE.Mesh(G.head, fur));
    const muzzle = new THREE.Mesh(G.muzzle, light);
    muzzle.scale.set(1.3, 0.8, 0.8);
    muzzle.position.set(0, -0.035, 0.075);
    this.head.add(muzzle);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(G.ear, fur);
      ear.position.set(sx * 0.058, 0.09, -0.01);
      ear.rotation.set(-0.15, sx * 0.4, sx * -0.3);
      this.head.add(ear);
      const eye = new THREE.Mesh(G.eye, EYE);
      eye.position.set(sx * 0.042, 0.018, 0.09);
      this.head.add(eye);
    }
    this.eyes = this.head.children.filter((c) => c.geometry === G.eye);
    const nose = new THREE.Mesh(G.nose, NOSE);
    nose.position.set(0, -0.01, 0.125);
    this.head.add(nose);

    this.legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.06, 0.16, sz * 0.13);
      this.body.add(hip);
      const leg = new THREE.Mesh(G.leg, fur);
      leg.position.y = -0.07;
      hip.add(leg);
      const paw = new THREE.Mesh(G.paw, light);
      paw.position.set(0, -0.135, 0.01);
      paw.scale.set(1, 0.6, 1.2);
      hip.add(paw);
      this.legs.push({ hip, front: sz > 0, side: sx });
    }

    this.tail = [];
    let parent = this.body;
    let pos = new THREE.Vector3(0, 0.24, -0.2);
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      seg.position.copy(pos);
      parent.add(seg);
      const m = new THREE.Mesh(G.tail, i === 3 && colors.belly !== colors.body && coat === "tuxedo" ? light : fur);
      m.rotation.x = Math.PI / 2;
      m.position.z = -0.06;
      seg.add(m);
      this.tail.push(seg);
      parent = seg;
      pos = new THREE.Vector3(0, 0, -0.12);
    }

    const blob = new THREE.Mesh(G.blob, BLOB);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    this.blob = blob;
    this.root.add(blob);
    const hit = new THREE.Mesh(G.hit, HIT);
    hit.position.y = 0.25;
    hit.userData.catId = id;
    this.root.add(hit);
    this.hitbox = hit;

    this.tagEl = document.createElement("div");
    this.tagEl.className = "tag cat-tag";
    this.tagEl.innerHTML = `<div class="tag-bubble" hidden></div><div class="tag-pill"><span class="emo">🐈</span><span class="tag-name"></span></div>`;
    this.tagEl.addEventListener("pointerup", (e) => {
      e.stopPropagation();
      onClick?.(id);
    });
    this.label = new CSS2DObject(this.tagEl);
    this.label.position.set(0, 0.75, 0);
    this.root.add(this.label);

    this.setName(name);
    this.pose = "sit";
    this.path = [];
    this.target = null;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 1.1;
    this.phase = Math.random() * 10;
    this.y = 0;
    this.jump = null;
    this.onArrive = null;
    this.bubbleTimer = null;
  }

  setName(name) {
    this.name = name;
    this.tagEl.querySelector(".tag-name").textContent = name;
  }

  say(text, ms = 2500) {
    const bubble = this.tagEl.querySelector(".tag-bubble");
    bubble.textContent = text;
    bubble.hidden = false;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => (bubble.hidden = true), ms);
  }

  place(spot, pose = "sit") {
    this.root.position.set(spot.x, spot.y || 0, spot.z);
    this.y = spot.y || 0;
    this.path = [];
    this.jump = null;
    this.target = spot;
    this.pose = pose;
    if (spot.facing !== undefined) this.heading = spot.facing;
  }

  walk(path, target, { pose = "sit", speed = 1.1, onArrive = null } = {}) {
    this.path = path.slice();
    this.target = target;
    this.endPose = pose;
    this.speed = speed;
    this.onArrive = onArrive;
    this.pose = "walk";
    this.jump = null;
    if (this.y > 0.01) {
      // Saut pour redescendre au sol
      this.y = 0;
      this.root.position.y = 0;
    }
  }

  get moving() {
    return this.path.length > 0 || !!this.jump;
  }

  update(dt) {
    this.phase += dt;
    const p = this.root.position;
    if (this.path.length) {
      const [tx, tz] = this.path[0];
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
        this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 9));
      }
      if (!this.path.length) {
        const t = this.target;
        if (t && (Math.hypot(t.x - p.x, t.z - p.z) > 0.05 || (t.y || 0) > 0.01)) {
          this.jump = { from: p.clone(), to: new THREE.Vector3(t.x, t.y || 0, t.z), t: 0, dur: (t.y || 0) > 0.3 ? 0.45 : 0.3 };
        } else {
          this.arrive();
        }
      }
    } else if (this.jump) {
      const j = this.jump;
      j.t = Math.min(1, j.t + dt / j.dur);
      p.lerpVectors(j.from, j.to, j.t);
      p.y += Math.sin(j.t * Math.PI) * 0.35;
      if (j.t >= 1) {
        this.jump = null;
        p.y = j.to.y;
        this.y = j.to.y;
        this.arrive();
      }
    } else if (this.target?.facing !== undefined) {
      this.heading = lerpAngle(this.heading, this.target.facing, Math.min(1, dt * 4));
    }
    this.root.rotation.y = this.heading;
    this.blob.visible = this.y < 0.05;
    this.animate();
  }

  arrive() {
    this.pose = this.endPose || "sit";
    const cb = this.onArrive;
    this.onArrive = null;
    cb?.();
  }

  animate() {
    const ph = this.phase;
    const pose = this.jump ? "walk" : this.pose;
    let bodyY = 0;
    let bodyX = 0;
    let headX = 0;
    let headY = Math.sin(ph * 0.5) * 0.3;
    let tailUp = 0.9;
    let tailSwish = Math.sin(ph * 1.6) * 0.35;
    let legSwing = 0;
    const legs = this.legs;
    const eyesOpen = pose !== "sleep";
    for (const e of this.eyes) e.scale.y = eyesOpen ? 1 : 0.15;

    if (pose === "walk") {
      legSwing = Math.sin(ph * (this.speed > 2 ? 22 : 12));
      bodyY = Math.abs(Math.cos(ph * 12)) * 0.012;
      headY = 0;
      tailUp = 1.2;
      tailSwish = Math.sin(ph * 3) * 0.2;
    } else if (pose === "sit") {
      bodyX = -0.5;
      bodyY = 0.05;
      headX = 0.45;
      tailUp = -0.2;
    } else if (pose === "sleep" || pose === "loaf") {
      bodyY = -0.1;
      headX = pose === "sleep" ? 0.35 : 0.05;
      headY = pose === "sleep" ? 0.6 : Math.sin(ph * 0.4) * 0.2;
      tailUp = -0.15;
      tailSwish = pose === "sleep" ? 0.9 : Math.sin(ph * 0.8) * 0.3 + 0.6;
      this.body.scale.y = 1 + Math.sin(ph * 1.8) * 0.02;
    } else if (pose === "play") {
      bodyX = -0.2;
      headX = 0.2;
      legSwing = 0;
      tailSwish = Math.sin(ph * 6) * 0.6;
    }
    if (pose !== "sleep" && pose !== "loaf") this.body.scale.y = 1;

    this.body.position.y = bodyY;
    this.body.rotation.x = bodyX;
    this.head.rotation.x = headX - bodyX;
    this.head.rotation.y = headY;
    for (const leg of legs) {
      let rx = 0;
      if (pose === "walk") rx = (leg.front === (leg.side > 0) ? 1 : -1) * legSwing * 0.6;
      else if (pose === "sit") rx = leg.front ? 0.5 : -1.3;
      else if (pose === "sleep" || pose === "loaf") rx = leg.front ? -1.4 : 1.4;
      else if (pose === "play" && leg.front && leg.side > 0) rx = -1.2 + Math.max(0, Math.sin(ph * 7)) * -0.6;
      leg.hip.rotation.x = rx;
      leg.hip.scale.y = pose === "sleep" || pose === "loaf" ? 0.6 : 1;
    }
    this.tail.forEach((seg, i) => {
      seg.rotation.x = i === 0 ? -tailUp : -tailUp * 0.25 + (pose === "walk" ? 0.1 : 0);
      seg.rotation.y = tailSwish * (0.4 + i * 0.25);
    });
  }

  dispose() {
    this.root.removeFromParent();
    this.label.element.remove();
    clearTimeout(this.bubbleTimer);
  }
}

// ---------------------------------------------------------------------------

const LOUNGE = AREAS.lounge.rect;
const NAP_SPOTS = [
  { x: 39.3, z: -6.3, y: 0.06, facing: -2.2 },
  { x: 39.2, z: 3.3, y: 0.06, facing: 2.6 },
  { x: 37.2, z: -6.55, y: 0.06, facing: 0.4 },
  { x: 35.1, z: -3.6, y: 0.45, facing: 1.2 },
  { x: 38.95, z: -1.0, y: 0.45, facing: -1.6 },
  { x: 32.7, z: -0.6, y: 0.42, facing: 0.8 },
  { x: 32.0, z: -6.2, y: 1.66, facing: 0.6 },
  { x: 32.15, z: -6.05, y: 1.14, facing: 0.2 },
];
const COPIER = { x: 21.75, z: 4.05, y: 1.06, facing: 0.3 };
const CARTONS = { x: 19.5, z: 12.6, y: 1.36, facing: -0.4 };
const FRIDGE = { x: -21.4, z: 15.3, facing: 3.1 };
const DIRECTOR_DESK = { x: -20.9, z: -13.6, y: 0.79, facing: 0.6 };

export class CatHerd {
  constructor(world) {
    this.world = world;
    this.cats = new Map();
    this.hidden = new Map(); // catId -> spot (quête « où est le chat ? »)
  }

  get life() {
    return this.world.life;
  }

  sync(list = []) {
    const ids = new Set(list.map((c) => c.id));
    for (const [id, cat] of this.cats) {
      if (!ids.has(id)) {
        cat.mesh.dispose();
        this.cats.delete(id);
      }
    }
    list.forEach((c, i) => {
      let cat = this.cats.get(c.id);
      if (!cat) {
        const mesh = new Cat({ id: c.id, name: c.name, coat: c.coat, onClick: (id) => this.world.onCat?.(id) });
        const spot = NAP_SPOTS[i % NAP_SPOTS.length];
        mesh.place(spot, i % 2 ? "sleep" : "loaf");
        this.world.scene.add(mesh.root);
        cat = { id: c.id, mesh, nextAt: performance.now() + 4000 + i * 3000, busyUntil: 0, task: null };
        this.cats.set(c.id, cat);
      }
      cat.mesh.setName(c.name);
    });
  }

  // Quêtes « où est passé le chat ? » : le chat attend sagement dans sa cachette.
  syncQuests(state) {
    const open = (state.life?.round?.quests || []).filter((q) => q.kind === "seek" && q.status === "open" && q.item?.catId);
    const wanted = new Map(open.map((q) => [q.item.catId, HIDING_SPOTS.find((s) => s.id === q.spotId)]));
    for (const [catId, spot] of wanted) {
      const cat = this.cats.get(catId);
      if (!cat || !spot) continue;
      if (this.hidden.get(catId) !== spot.id) {
        this.hidden.set(catId, spot.id);
        cat.mesh.place({ x: spot.x, z: spot.z, y: Math.max(0, spot.y - 0.04), facing: Math.random() * 6 }, "loaf");
      }
    }
    for (const catId of [...this.hidden.keys()]) {
      if (wanted.has(catId)) continue;
      this.hidden.delete(catId);
      const cat = this.cats.get(catId);
      if (cat) {
        cat.mesh.say("Miaou ! 😺", 2500);
        cat.busyUntil = 0;
        cat.nextAt = performance.now() + 2500;
      }
    }
  }

  isHidden(catId) {
    return this.hidden.has(catId);
  }

  go(cat, spot, { pose = "sit", speed = 1.1, dwell = 8000, onArrive } = {}) {
    const p = cat.mesh.root.position;
    const path = this.world.nav.findPath([p.x, p.z], [spot.x, spot.z]);
    cat.mesh.walk(path, spot, {
      pose,
      speed,
      onArrive: () => {
        cat.busyUntil = performance.now() + dwell;
        onArrive?.();
      },
    });
    cat.busyUntil = Infinity;
  }

  randomLoungePoint() {
    const [x0, z0, x1, z1] = LOUNGE;
    for (let i = 0; i < 12; i++) {
      const x = between(x0 + 0.6, x1 - 0.6);
      const z = between(z0 + 0.6, z1 - 0.6);
      const [c, r] = this.world.nav.toCell(x, z);
      if (this.world.nav.isFree(c, r)) return { x, z, facing: Math.random() * 6 };
    }
    return { x: 35.5, z: -1.6, facing: 0 };
  }

  tick(now) {
    for (const cat of this.cats.values()) {
      if (this.hidden.has(cat.id) || cat.mesh.moving || now < cat.busyUntil || now < cat.nextAt) continue;
      cat.nextAt = now + between(3000, 9000);
      this.behave(cat);
    }
  }

  behave(cat) {
    const r = Math.random();
    const name = cat.mesh.name;
    if (r < 0.3) {
      this.go(cat, rand(NAP_SPOTS), { pose: "sleep", dwell: between(25000, 60000), onArrive: () => Math.random() < 0.3 && cat.mesh.say("💤", 3000) });
    } else if (r < 0.48) {
      this.go(cat, this.randomLoungePoint(), { pose: Math.random() < 0.5 ? "sit" : "play", dwell: between(5000, 12000) });
    } else if (r < 0.62) {
      this.keyboardNap(cat);
    } else if (r < 0.7) {
      this.go(cat, COPIER, {
        pose: "sleep",
        dwell: 30000,
        onArrive: () => {
          cat.mesh.say("Elle est toute chaude 😌", 2500);
          this.life?.log("🖨️", `${name} fait la sieste sur la photocopieuse (elle est chaude).`);
        },
      });
    } else if (r < 0.78) {
      this.follow(cat);
    } else if (r < 0.85) {
      this.go(cat, FRIDGE, {
        pose: "sit",
        dwell: 9000,
        onArrive: () => {
          cat.mesh.say("Miaou ? 🥺", 2500);
          const cook = this.life?.available().find((a) => Math.hypot(a.person.root.position.x - FRIDGE.x, a.person.root.position.z - FRIDGE.z) < 5);
          cook?.person.say(`Non ${name}, c'est MON jambon.`, 2600);
        },
      });
    } else if (r < 0.92) {
      this.go(cat, CARTONS, { pose: "loaf", dwell: 30000, onArrive: () => this.life?.log("📦", `${name} a pris possession d'un carton de l'entrepôt. Moussa n'ose plus y toucher.`) });
    } else if (r < 0.96) {
      this.go(cat, DIRECTOR_DESK, {
        pose: "sit",
        dwell: 15000,
        onArrive: () => {
          this.world.actors.get("director")?.person.say(`${name}, descends de mon bureau. S'il te plaît. 🥲`, 2800);
          this.life?.log("👔", `${name} s'est installé sur le bureau du directeur.`);
        },
      });
    } else {
      this.zoomies(cat);
    }
  }

  keyboardNap(cat) {
    const workers = [...this.world.actors.values()].filter((a) => a.working && a.home && !a.home.standing && !a.trip.length && !a.meetingSeat && !a.person.moving);
    if (!workers.length) return this.go(cat, rand(NAP_SPOTS), { pose: "sleep", dwell: 30000 });
    const victim = rand(workers);
    const top = deskTop(victim.home);
    const name = cat.mesh.name;
    this.go(cat, { x: top.x - top.fx * 0.12, z: top.z - top.fz * 0.12, y: 0.78, facing: victim.home.facing + Math.PI }, {
      pose: "sleep",
      dwell: 22000,
      onArrive: () => {
        const who = this.world.state?.agents.find((a) => a.id === victim.agentId)?.name || "quelqu'un";
        victim.person.say(rand([`${name}… je bosse, là 😩`, `Pousse-toi ${name}, j'ai une deadline !`, "jjjjjjjjjjjjjjjjj (le chat est sur le clavier)"]), 3000);
        this.life?.log("⌨️", `${name} dort sur le clavier de ${who}.`, victim.agentId);
      },
    });
  }

  follow(cat) {
    const target = rand([...this.world.actors.values()].filter((a) => !a.meetingSeat));
    if (!target) return;
    let hops = 0;
    const step = () => {
      const p = target.person.root.position;
      const spot = { x: p.x + between(-0.6, 0.6), z: p.z + between(0.5, 0.9) };
      this.go(cat, spot, {
        pose: "sit",
        speed: 1.6,
        dwell: 1200,
        onArrive: () => {
          hops += 1;
          if (hops === 1) target.person.say(rand(["Toi aussi tu veux un café ?", "Je n'ai PAS de croquettes sur moi.", "Pourquoi il me suit ?? 😅"]), 2500);
          if (hops < 4) setTimeout(step, 1300);
        },
      });
    };
    step();
  }

  zoomies(cat) {
    const points = [this.randomLoungePoint(), this.randomLoungePoint(), this.randomLoungePoint()];
    cat.mesh.say("💨", 1500);
    const run = (i) => {
      if (i >= points.length) return;
      this.go(cat, points[i], { pose: "play", speed: 3.2, dwell: 200, onArrive: () => setTimeout(() => run(i + 1), 200) });
    };
    run(0);
  }

  // Un collègue vient caresser un chat (appelé par la vie de bureau).
  petBy(actor) {
    const cats = [...this.cats.values()].filter((c) => !c.mesh.moving && !this.hidden.has(c.id) && c.mesh.y < 0.5);
    if (!cats.length) return false;
    const cat = rand(cats);
    const p = cat.mesh.root.position;
    const angle = Math.random() * Math.PI * 2;
    const spot = { x: p.x + Math.cos(angle) * 0.7, z: p.z + Math.sin(angle) * 0.7, standing: true };
    spot.facing = Math.atan2(p.x - spot.x, p.z - spot.z);
    cat.busyUntil = performance.now() + 20000;
    actor.trip.push({
      spot,
      activity: "pet",
      dwell: 6000,
      onArrive: () => {
        cat.mesh.say("💕 rrrrr", 3000);
        actor.person.say(rand([`Qui c'est le plus beau ? C'est ${cat.mesh.name} !`, "Pause câlins 🥹", "Meilleur collègue du bureau."]), 2600);
      },
    });
    return cat;
  }

  update(dt) {
    for (const cat of this.cats.values()) cat.mesh.update(dt);
  }

  pick(raycaster) {
    const hits = raycaster.intersectObjects([...this.cats.values()].map((c) => c.mesh.hitbox), false);
    return hits[0]?.object.userData.catId || null;
  }

  setCompact(compact) {
    for (const cat of this.cats.values()) cat.mesh.tagEl.classList.toggle("compact", compact);
  }
}
