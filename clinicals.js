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

let tabIndex = 0;
let step = 0;
let offsetX = 0;
let drag = null;
let raf = 0;
let suppressClick = false;

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
    node.classList.toggle("is-on", Number(node.dataset.node) <= index);
  });
}

function applyStep(next, { animate = true } = {}) {
  step = clamp(next, 0, STEPS - 1);
  root.dataset.step = String(step);
  setActiveVisual(step);
  setOffset(step * stride(), { animate });
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

function onPointerDown(event) {
  if (!event.isPrimary || event.button !== 0) return;
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
    const s = stride() || 1;
    setActiveVisual(
      clamp(drag.originStep + Math.round((offsetX - drag.originOffset) / s), 0, STEPS - 1)
    );
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

document.addEventListener(
  "click",
  (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true
);

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

applyTab(0);
applyStep(0, { animate: false });
