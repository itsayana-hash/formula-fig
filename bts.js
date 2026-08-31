const root = document.querySelector(".bts");
const world = document.querySelector("[data-world]");
const proto = document.querySelector("[data-tile]");
const DESKTOP_MQ = "(min-width: 860px)";
const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)");

const DESIGN = {
  desktop: { w: 1440, h: 800 },
  mobile: { w: 390, h: 844 },
};

const TILES = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const DEPTH = {
  bottles: 0.36,
  formulations: 0.42,
  bowl: 0.5,
  moodboard: 0.7,
  tray: 0.76,
  portrait: 0.72,
  tubes: 0.84,
  caps: 0.92,
  silhouette: 1,
};

const DRAG_TRACK = 0.5544;
const PAN_FOLLOW = 3.6;
const VEL_DECAY = 0.82;
const VEL_SAMPLE = 0.14;
const REDUCE_DECAY = 0.62;
const DANCE_AMP = 56;
const FOLLOW_NEAR = 6.4;
const FOLLOW_FAR = 2.7;

let tiles = [];
let cards = [];
let sx = 0;
let sy = 0;
let panTx = 0;
let panTy = 0;
let vx = 0;
let vy = 0;
let danceTx = 0;
let danceTy = 0;
let stageScale = 1;
let fieldW = DESIGN.mobile.w;
let fieldH = DESIGN.mobile.h;
let raf = 0;
let last = 0;
let dragging = false;
let lastMouse = null;

function isDesktop() {
  return window.matchMedia(DESKTOP_MQ).matches;
}

function field() {
  return isDesktop() ? DESIGN.desktop : DESIGN.mobile;
}

function posMod(n, span) {
  return ((n % span) + span) % span;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function panMul(depth) {
  return 0.48 + depth * 0.7;
}

function layerScale(depth) {
  return 0.9 + depth * 0.18;
}

function layerZ(depth) {
  return (depth - 0.55) * 160;
}

function followRate(depth) {
  return FOLLOW_FAR + (FOLLOW_NEAR - FOLLOW_FAR) * depth;
}

function sizeStage() {
  const box = field();
  fieldW = box.w;
  fieldH = box.h;
  stageScale = Math.max(window.innerWidth / box.w, window.innerHeight / box.h);
  root.style.setProperty("--bts-w", `${box.w}px`);
  root.style.setProperty("--bts-h", `${box.h}px`);
  root.style.setProperty("--bts-scale", String(stageScale));
}

function buildTiles() {
  world.querySelectorAll("[data-clone]").forEach((node) => node.remove());
  proto.removeAttribute("data-clone");
  TILES.forEach(([i, j]) => {
    if (i === 0 && j === 0) {
      proto.dataset.i = "0";
      proto.dataset.j = "0";
      return;
    }
    const clone = proto.cloneNode(true);
    clone.dataset.clone = "1";
    clone.dataset.i = String(i);
    clone.dataset.j = String(j);
    world.appendChild(clone);
  });
  tiles = [...world.querySelectorAll("[data-tile]")];
  cards = tiles.flatMap((tile) => {
    const i = Number(tile.dataset.i);
    const j = Number(tile.dataset.j);
    return [...tile.querySelectorAll("[data-layer]")].map((el) => ({
      el,
      i,
      j,
      depth: DEPTH[el.dataset.layer] ?? 0.6,
      danceX: 0,
      danceY: 0,
    }));
  });
}

function paint() {
  const reduce = REDUCE.matches;
  cards.forEach((card) => {
    const mul = panMul(card.depth);
    const dance = reduce ? 0 : DANCE_AMP * (0.45 + card.depth * 0.7);
    const ox = posMod(sx * mul, fieldW) + card.danceX * dance;
    const oy = posMod(sy * mul, fieldH) + card.danceY * dance;
    const x = card.i * fieldW + ox;
    const y = card.j * fieldH + oy;
    const z = layerZ(card.depth);
    const s = layerScale(card.depth);
    card.el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) scale(${s})`;
  });
}

function tick(now) {
  const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
  last = now;
  const reduce = REDUCE.matches;

  const panK = 1 - Math.exp(-(reduce ? 10 : PAN_FOLLOW) * dt);
  sx += (panTx - sx) * panK;
  sy += (panTy - sy) * panK;

  if (!dragging) {
    const decay = Math.pow(reduce ? REDUCE_DECAY : VEL_DECAY, dt * 60);
    vx *= decay;
    vy *= decay;
    panTx += vx;
    panTy += vy;
    if (Math.abs(vx) < 0.015) vx = 0;
    if (Math.abs(vy) < 0.015) vy = 0;
  }

  cards.forEach((card) => {
    if (reduce) {
      card.danceX = 0;
      card.danceY = 0;
      return;
    }
    const k = 1 - Math.exp(-followRate(card.depth) * dt);
    card.danceX += (danceTx - card.danceX) * k;
    card.danceY += (danceTy - card.danceY) * k;
  });

  paint();
  raf = requestAnimationFrame(tick);
}

function toDesign(dx, dy) {
  return [dx / stageScale, dy / stageScale];
}

function pointerNorm(event) {
  const rect = root.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  return [clamp(x, -1, 1), clamp(y, -1, 1)];
}

function setDance(x, y) {
  danceTx = x;
  danceTy = y;
}

function panBy(dx, dy) {
  const step = REDUCE.matches ? dx * 0.28 : dx * DRAG_TRACK;
  const stepY = REDUCE.matches ? dy * 0.28 : dy * DRAG_TRACK;
  panTx += step;
  panTy += stepY;
  if (REDUCE.matches) {
    vx = 0;
    vy = 0;
    return;
  }
  vx = vx * (1 - VEL_SAMPLE) + step * VEL_SAMPLE;
  vy = vy * (1 - VEL_SAMPLE) + stepY * VEL_SAMPLE;
}

function onPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  dragging = true;
  lastMouse = { x: event.clientX, y: event.clientY };
  vx = 0;
  vy = 0;
  setDance(...pointerNorm(event));
  root.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  setDance(...pointerNorm(event));
  if (!dragging || !lastMouse) return;
  const [dx, dy] = toDesign(
    event.clientX - lastMouse.x,
    event.clientY - lastMouse.y
  );
  lastMouse = { x: event.clientX, y: event.clientY };
  panBy(dx * DRAG_TRACK, dy * DRAG_TRACK);
}

function onPointerUp(event) {
  if (!dragging) return;
  dragging = false;
  lastMouse = null;
  try {
    root.releasePointerCapture(event.pointerId);
  } catch (err) {
    /* already released */
  }
}

function onPointerLeave() {
  if (!dragging) setDance(0, 0);
}

function onPointerEnter(event) {
  setDance(...pointerNorm(event));
}

function onResize() {
  sizeStage();
  paint();
}

sizeStage();
buildTiles();
paint();
raf = requestAnimationFrame(tick);

window.addEventListener("resize", onResize);
root.addEventListener("pointerdown", onPointerDown);
root.addEventListener("pointermove", onPointerMove);
root.addEventListener("pointerup", onPointerUp);
root.addEventListener("pointercancel", onPointerUp);
root.addEventListener("pointerleave", onPointerLeave);
root.addEventListener("pointerenter", onPointerEnter);
