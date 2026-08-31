const root = document.querySelector(".clinicals");
const stage = document.querySelector(".clinicals-stage");
const row = document.querySelector("[data-row]");
const cards = [...document.querySelectorAll("[data-card]")];
const nodes = [...document.querySelectorAll("[data-node]")];
const tabs = [...document.querySelectorAll("[data-tab]")];
const bgs = [...document.querySelectorAll("[data-bg]")];
const prevTab = document.querySelector("[data-tab-prev]");
const nextTab = document.querySelector("[data-tab-next]");

const TAB_ORDER = ["cleanse", "balance", "treat", "protect"];
const STEPS = cards.length;
const DRAG_THRESHOLD = 8;
const SNAP_PX = 32;
const WHEEL_SNAP = 36;
const WHEEL_LOCK_MS = 480;
const DESKTOP_MQ = "(min-width: 860px)";

let tabIndex = 0;
let step = 0;
let offsetX = 0;
let drag = null;
let raf = 0;
let suppressClick = false;
let wheelAccum = 0;
let wheelLock = false;
let wheelReset = 0;
let wheelUnlock = 0;

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

function setOffset(x, { animate = false } = {}) {
  offsetX = clamp(x, 0, maxOffset());
  row.style.transition = animate ? `transform ${durationEase()}` : "none";
  row.style.transform = `translate3d(${-offsetX}px, 0, 0)`;
  const s = stride();
  root.style.setProperty("--clinicals-step", s ? String(offsetX / s) : String(step));
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

function wheelDeltaX(event) {
  let x = event.deltaX;
  let y = event.deltaY;
  if (event.deltaMode === 1) {
    x *= 16;
    y *= 16;
  } else if (event.deltaMode === 2) {
    x *= root.clientWidth;
    y *= root.clientHeight;
  }
  if (event.shiftKey && Math.abs(x) < Math.abs(y)) return y;
  return x;
}

function lockWheel() {
  wheelLock = true;
  wheelAccum = 0;
  window.clearTimeout(wheelUnlock);
  wheelUnlock = window.setTimeout(() => {
    wheelLock = false;
    wheelAccum = 0;
  }, WHEEL_LOCK_MS);
}

function onWheel(event) {
  if (drag) return;

  const dx = event.deltaX;
  const dy = event.deltaY;
  const horizontal = wheelDeltaX(event);
  const vertical = event.shiftKey ? 0 : dy;

  if (Math.abs(horizontal) < 1) return;
  if (!event.shiftKey && Math.abs(vertical) > Math.abs(dx) * 1.25) return;

  event.preventDefault();
  if (wheelLock) return;

  wheelAccum += horizontal;
  window.clearTimeout(wheelReset);
  wheelReset = window.setTimeout(() => {
    wheelAccum = 0;
  }, 80);

  if (wheelAccum >= WHEEL_SNAP && goStep(step + 1)) {
    lockWheel();
  } else if (wheelAccum <= -WHEEL_SNAP && goStep(step - 1)) {
    lockWheel();
  }
}

function onKeydown(event) {
  if (!isDesktop()) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

  event.preventDefault();
  goStep(event.key === "ArrowRight" ? step + 1 : step - 1);
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
    peakDx: 0,
    originOffset: offsetX,
    originStep: step,
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
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.75) {
      const id = drag.id;
      drag = null;
      releaseCapture(id);
      return;
    }
    drag.moving = true;
    stage.classList.add("is-dragging");
    row.style.transition = "none";
  }

  drag.lastX = event.clientX;
  const liveDx = event.clientX - drag.originX;
  if (Math.abs(liveDx) >= Math.abs(drag.peakDx)) drag.peakDx = liveDx;
  if (event.cancelable) event.preventDefault();
  if (raf) return;

  raf = requestAnimationFrame(() => {
    raf = 0;
    if (!drag) return;
    setOffset(drag.originOffset - (drag.lastX - drag.originX));
  });
}

function onLostCapture(event) {
  if (!drag || event.pointerId !== drag.id || !drag.moving) return;
  finishDrag(event);
}

function onTabClick(name) {
  const next = TAB_ORDER.indexOf(name);
  if (next === tabIndex) return;
  applyTab(next);
  applyStep(0);
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
  applyTab(tabIndex - 1);
  applyStep(0);
});

nextTab?.addEventListener("click", () => {
  applyTab(tabIndex + 1);
  applyStep(0);
});

window.addEventListener("resize", () => {
  if (drag) return;
  applyStep(step, { animate: false });
});

const startTab = TAB_ORDER.indexOf(new URLSearchParams(location.search).get("tab"));
applyTab(startTab >= 0 ? startTab : 0);
applyStep(0, { animate: false });
