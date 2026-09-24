const root = document.querySelector(".clinicals");
const stage = document.querySelector(".clinicals-stage");
const row = document.querySelector("[data-row]");
const tabsEl = document.querySelector(".clinicals-tabs");
const indicator = document.querySelector(".clinicals-tab-indicator");
const cards = [...document.querySelectorAll("[data-card]")];
const nodes = [...document.querySelectorAll("[data-node]")];
const tabs = [...document.querySelectorAll(".clinicals-tab[data-tab]")];
const bgs = [...document.querySelectorAll("[data-bg]")];
const prevTab = document.querySelector("[data-tab-prev]");
const nextTab = document.querySelector("[data-tab-next]");
const stats = [...document.querySelectorAll(".clinicals-stat")];

const TAB_ORDER = ["cleanse", "balance", "treat", "protect"];
const STEPS = cards.length;
const DRAG_THRESHOLD = 8;
const SNAP_PX = 32;
const WHEEL_SNAP = 36;
const WHEEL_LOCK_MS = 480;
const DESKTOP_MQ = "(min-width: 860px)";
const NUDGE_MS = 420;

let tabIndex = 0;
let step = 0;
let offsetX = 0;
let drag = null;
let raf = 0;
let suppressClick = false;
let wheelAccum = 0;
let wheelAxis = null;
let wheelLock = false;
let wheelReset = 0;
let wheelUnlock = 0;
let introNudgePlayed = false;
let indicatorReady = false;
let indicatorX = 0;
let indicatorY = 0;
let indicatorW = 0;
let indicatorH = 0;

function cardWidth() {
  const laidOut = cards[0].offsetWidth;
  if (laidOut > 0) return laidOut;
  return parseFloat(getComputedStyle(root).getPropertyValue("--clinicals-card")) || 310;
}

function cardGap() {
  const styles = getComputedStyle(row.querySelector(".clinicals-cards"));
  return parseFloat(styles.columnGap || styles.gap) || 10;
}

function stride() {
  return cardWidth() + cardGap();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function maxOffset() {
  return (STEPS - 1) * stride();
}

function durationEase() {
  const styles = getComputedStyle(root);
  const duration = styles.getPropertyValue("--duration").trim() || "700ms";
  const ease = styles.getPropertyValue("--ease").trim() || "ease";
  return `${duration} ${ease}`;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setOffset(x, { animate = false } = {}) {
  offsetX = clamp(x, 0, maxOffset());
  row.style.transition = animate ? `transform ${durationEase()}` : "none";
  row.style.transform = `translate3d(${-offsetX}px, 0, 0)`;
  const s = stride();
  const progress = s ? offsetX / s : step;
  root.style.setProperty("--clinicals-step", String(progress));
  updateCardFocus(progress);
}

function updateCardFocus(progress) {
  cards.forEach((card, i) => {
    card.style.setProperty("--card-dist", String(Math.abs(i - progress)));
  });
}

function setActiveVisual(index) {
  cards.forEach((card, i) => {
    card.classList.toggle("is-active", i === index);
    card.classList.toggle("is-past", i < index);
  });
  nodes.forEach((node) => {
    const i = Number(node.dataset.node);
    node.classList.toggle("is-on", i <= index);
    if (i === index) node.setAttribute("aria-current", "step");
    else node.removeAttribute("aria-current");
  });
}

function applyStep(next, { animate = true } = {}) {
  step = clamp(next, 0, STEPS - 1);
  root.dataset.step = String(step);
  setActiveVisual(step);
  setOffset(step * stride(), { animate });
}

function goStep(next) {
  const clamped = clamp(next, 0, STEPS - 1);
  if (clamped === step) return false;
  applyStep(clamped);
  return true;
}

function isDesktop() {
  return window.matchMedia(DESKTOP_MQ).matches;
}

function isTypingTarget(target) {
  return Boolean(
    target?.closest?.("input, textarea, select, [contenteditable='true']")
  );
}

function wheelDeltas(event) {
  let x = event.deltaX;
  let y = event.deltaY;
  if (event.deltaMode === 1) {
    x *= 16;
    y *= 16;
  } else if (event.deltaMode === 2) {
    x *= root.clientWidth;
    y *= root.clientHeight;
  }
  if (event.shiftKey && Math.abs(x) < Math.abs(y)) {
    return { x: y, y: 0 };
  }
  return { x, y };
}

function lockWheel() {
  wheelLock = true;
  wheelAccum = 0;
  wheelAxis = null;
  window.clearTimeout(wheelUnlock);
  wheelUnlock = window.setTimeout(() => {
    wheelLock = false;
    wheelAccum = 0;
    wheelAxis = null;
  }, WHEEL_LOCK_MS);
}

function onWheel(event) {
  if (drag) return;

  const { x, y } = wheelDeltas(event);
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (absX < 1 && absY < 1) return;

  // Horizontal card scroll only — no vertical tab switching.
  const axis = absX >= absY * 1.25 ? "x" : null;
  if (!axis) return;

  event.preventDefault();
  if (wheelLock) return;

  if (wheelAxis && wheelAxis !== axis) wheelAccum = 0;
  wheelAxis = axis;
  wheelAccum += x;

  window.clearTimeout(wheelReset);
  wheelReset = window.setTimeout(() => {
    wheelAccum = 0;
    wheelAxis = null;
  }, 80);

  if (wheelAccum >= WHEEL_SNAP && goStep(step + 1)) lockWheel();
  else if (wheelAccum <= -WHEEL_SNAP && goStep(step - 1)) lockWheel();
}

function onKeydown(event) {
  if (!isDesktop()) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    goStep(event.key === "ArrowRight" ? step + 1 : step - 1);
  }
}

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playCardsIn() {
  if (reduceMotion()) {
    root.classList.add("is-cards-ready");
    return;
  }

  root.classList.remove("is-cards-ready");
  cards.forEach((card) => {
    card.style.transition = "none";
  });
  stats.forEach((stat) => {
    stat.style.transition = "none";
  });
  void root.offsetWidth;
  cards.forEach((card) => {
    card.style.transition = "";
  });
  stats.forEach((stat) => {
    stat.style.transition = "";
  });
  requestAnimationFrame(() => {
    root.classList.add("is-cards-ready");
  });
}

function goTab(next, { resetStep = true } = {}) {
  const clamped = clamp(next, 0, TAB_ORDER.length - 1);
  if (clamped === tabIndex) return false;
  applyTab(clamped);
  if (resetStep) applyStep(0);
  return true;
}

function syncTabIndicator({ animate = true } = {}) {
  if (!indicator || !tabsEl) return;
  const active = tabs[tabIndex];
  if (!active) return;

  const tabsBox = tabsEl.getBoundingClientRect();
  const tabBox = active.getBoundingClientRect();
  indicatorX = tabBox.left - tabsBox.left;
  indicatorY = tabBox.top - tabsBox.top;
  indicatorW = tabBox.width;
  indicatorH = tabBox.height;

  if (!animate || reduceMotion()) {
    indicator.style.transition = "none";
  }
  indicator.style.transform = "translate3d(0, 0, 0)";
  indicator.style.left = `${indicatorX}px`;
  indicator.style.top = `${indicatorY}px`;
  indicator.style.width = `${indicatorW}px`;
  indicator.style.height = `${indicatorH}px`;
  if (!animate || reduceMotion()) {
    void indicator.offsetWidth;
    indicator.style.transition = "";
  }
}

function applyTab(next) {
  tabIndex = clamp(next, 0, TAB_ORDER.length - 1);
  const name = TAB_ORDER[tabIndex];
  root.dataset.tab = name;
  tabs.forEach((tab) => {
    const on = tab.dataset.tab === name;
    tab.classList.toggle("is-active", on);
    tab.setAttribute("aria-selected", String(on));
  });
  bgs.forEach((bg) => {
    bg.classList.toggle("is-on", bg.dataset.bg === name);
  });
  prevTab?.toggleAttribute("disabled", tabIndex <= 0);
  nextTab?.toggleAttribute("disabled", tabIndex >= TAB_ORDER.length - 1);
  syncTabIndicator({ animate: indicatorReady });
  indicatorReady = true;
  playCardsIn();
}

async function playIntroNudges() {
  if (introNudgePlayed || reduceMotion()) return;
  if (tabIndex !== 0 || root.dataset.tab !== "cleanse") return;
  introNudgePlayed = true;

  await sleep(520);

  if (row) {
    const base = -offsetX;
    row.style.transition = `transform ${NUDGE_MS}ms ease`;
    row.style.transform = `translate3d(${base - 20}px, 0, 0)`;
    await sleep(NUDGE_MS);
    row.style.transform = `translate3d(${base}px, 0, 0)`;
    await sleep(NUDGE_MS);
    row.style.transition = "";
    setOffset(offsetX, { animate: false });
  }

  // Highlight keeps Cleanse size; slides so its right edge hits mid-Balance, then returns.
  if (indicator && tabsEl && tabs[0] && tabs[1]) {
    syncTabIndicator({ animate: false });
    const tabsBox = tabsEl.getBoundingClientRect();
    const balanceBox = tabs[1].getBoundingClientRect();
    const targetRight = balanceBox.left - tabsBox.left + balanceBox.width * 0.5;
    const nudgeX = targetRight - (indicatorX + indicatorW);

    indicator.style.transition = `transform ${NUDGE_MS}ms ease`;
    indicator.style.transform = `translate3d(${nudgeX}px, 0, 0)`;
    await sleep(NUDGE_MS);
    indicator.style.transform = "translate3d(0, 0, 0)";
    await sleep(NUDGE_MS);
    indicator.style.transition = "";
    syncTabIndicator({ animate: false });
  }
}

function releaseCapture(id) {
  try {
    if (id != null && stage.hasPointerCapture(id)) {
      stage.releasePointerCapture(id);
    }
  } catch (_) {}
}

function armClickSuppression() {
  suppressClick = true;
  window.setTimeout(() => {
    suppressClick = false;
  }, 0);
}

function stepFromGesture(session, clientX) {
  const releaseDx = clientX - session.originX;
  const lastDx = session.lastX - session.originX;
  const peakDx = session.peakDx;
  const offsetDelta = offsetX - session.originOffset;
  const pointerDelta = [releaseDx, lastDx, peakDx].sort(
    (a, b) => Math.abs(b) - Math.abs(a)
  )[0];

  if (pointerDelta <= -SNAP_PX || offsetDelta >= SNAP_PX) {
    return session.originStep + 1;
  }
  if (pointerDelta >= SNAP_PX || offsetDelta <= -SNAP_PX) {
    return session.originStep - 1;
  }
  return session.originStep;
}

function finishDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;

  const session = drag;
  drag = null;
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  stage.classList.remove("is-dragging");
  releaseCapture(event.pointerId);

  if (!session.moving) return;

  armClickSuppression();

  const clientX = Number.isFinite(event.clientX) ? event.clientX : session.lastX;
  applyStep(stepFromGesture(session, clientX));
}

function onNodeClick(event) {
  if (!isDesktop()) return;
  event.preventDefault();
  event.stopPropagation();
  const index = Number(event.currentTarget.dataset.node);
  if (!Number.isFinite(index)) return;
  applyStep(index);
}

function onPointerDown(event) {
  if (!event.isPrimary || event.button !== 0) return;
  if (event.target.closest("[data-node]")) return;
  if (event.cancelable) event.preventDefault();

  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  drag = {
    id: event.pointerId,
    originX: event.clientX,
    originY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    peakDx: 0,
    peakDy: 0,
    originOffset: offsetX,
    originStep: step,
    axis: null,
    moving: false,
  };

  try {
    stage.setPointerCapture(event.pointerId);
  } catch (_) {}
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.id) return;

  const deltaX = event.clientX - drag.originX;
  const deltaY = event.clientY - drag.originY;

  if (!drag.moving) {
    if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    // Horizontal timeline only — ignore mostly-vertical gestures.
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    drag.axis = "x";
    drag.moving = true;
    stage.classList.add("is-dragging");
    row.style.transition = "none";
  }

  drag.lastX = event.clientX;
  drag.lastY = event.clientY;

  const liveDx = event.clientX - drag.originX;
  if (Math.abs(liveDx) >= Math.abs(drag.peakDx)) drag.peakDx = liveDx;
  if (event.cancelable) event.preventDefault();
  if (raf) return;

  raf = requestAnimationFrame(() => {
    raf = 0;
    if (!drag || drag.axis !== "x") return;
    setOffset(drag.originOffset - (drag.lastX - drag.originX));
  });
}

function onLostCapture(event) {
  if (!drag || event.pointerId !== drag.id || !drag.moving) return;
  finishDrag(event);
}

function onTabClick(name) {
  const next = TAB_ORDER.indexOf(name);
  if (next < 0) return;
  goTab(next);
}

root.querySelectorAll("img").forEach((img) => {
  img.setAttribute("draggable", "false");
  img.addEventListener("dragstart", (event) => event.preventDefault());
});

stage.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove, { passive: false });
window.addEventListener("pointerup", finishDrag);
window.addEventListener("pointercancel", finishDrag);
stage.addEventListener("lostpointercapture", onLostCapture);
root.addEventListener("wheel", onWheel, { passive: false });
document.addEventListener("keydown", onKeydown);

document.addEventListener(
  "click",
  (event) => {
    if (!suppressClick) return;
    if (event.target.closest("[data-node]")) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true
);

nodes.forEach((node) => {
  node.addEventListener("click", onNodeClick);
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => onTabClick(tab.dataset.tab));
});

prevTab?.addEventListener("click", () => {
  goTab(tabIndex - 1);
});

nextTab?.addEventListener("click", () => {
  goTab(tabIndex + 1);
});

window.addEventListener("resize", () => {
  if (drag) return;
  applyStep(step, { animate: false });
  syncTabIndicator({ animate: false });
});

const startTab = TAB_ORDER.indexOf(new URLSearchParams(location.search).get("tab"));
applyTab(startTab >= 0 ? startTab : 0);
applyStep(0, { animate: false });
syncTabIndicator({ animate: false });
requestAnimationFrame(() => {
  syncTabIndicator({ animate: false });
  playIntroNudges();
});
