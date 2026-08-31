const PRODUCTS = [
  {
    title: "Amino Balancing Gel Cleanser",
    description:
      "This gel cleanser thoroughly removes makeup, SPF, excess oil, and daily impurities without stripping skin of its natural moisture. It rinses completely clean with no residue, leaving skin balanced and perfectly prepped for the facial or routine that follows.",
    price: "$33",
    cardTitle: "Amino Balancing Gel Cleanser",
    thumb: "assets/card-1.png",
    thumbSize: [140, 174],
    label: "Amino Balancing Gel Cleanser",
  },
  {
    title: "Hydra-Ferment Activating Essence",
    description:
      "This hydrating essence delivers an immediate moisture boost, helps maintain hydration throughout the day, and provides antioxidant support against environmental stressors. It leaves skin visibly dewy and perfectly primed for every formula that follows.",
    price: "$45",
    cardTitle: "Hydra-Ferment Activating Essence",
    thumb: "assets/card-2.png",
    thumbSize: [140, 174],
    label: "Hydra-Ferment Activating Essence",
  },
  {
    title: "Barrier Cushioning Gel Cream",
    description:
      "This gel cream delivers breathable, cushioning hydration that supports the skin barrier. It leaves skin looking smoother and more radiant, and feeling soft and resilient with a velvety, non-greasy finish.",
    price: "$65",
    cardTitle: "Barrier Cushioning Gel Cream",
    thumb: "assets/card-3.png",
    thumbSize: [140, 174],
    label: "Barrier Cushioning Gel Cream",
  },
  {
    title: "Multi-Layer Hydration Matrix Serum",
    description:
      "A silky gel serum that hydrates through complementary pathways to attract and bind water, support water balance, and improve moisture retention. It delivers immediate and lasting hydration, leaving skin visibly plumper, smoother, and more supple.",
    price: "$60",
    cardTitle: "Multi-Layer Hydration Matrix Serum",
    thumb: "assets/card-4.png",
    thumbSize: [140, 174],
    label: "Multi-Layer Hydration Matrix Serum",
  },
];

const SET = {
  title: "The FFFull Set",
  description:
    "A complete daily skincare routine, built on treatment-room science.",
  details:
    "Four complementary formulas, packaged as one daily cadence. Apply morning and night as directed.",
  price: "$125",
  cardTitle: "The FFFull Set",
  thumb: "assets/card-set.png",
  thumbSize: [140, 174],
  label: "The FFFull Set",
};

const STEPS = ["set", "0", "1", "2", "3"];
const DRAG_THRESHOLD = 12;
const SNAP_MIN = 48;
const SNAP_MAX = 64;
const SNAP_RATIO = 0.15;

const highlight = document.querySelector(".highlight");
const hero = document.querySelector(".hero");
const bottlesRow = document.querySelector(".bottles");
const bottles = document.querySelectorAll(".bottle");
const detailsLink = document.querySelector(".details-link");
const details = document.querySelector("#product-details");
const detailsOverlay = document.querySelector("#details-overlay");
const detailsDrawer = document.querySelector("#details-drawer");
const detailsScrim = document.querySelector(".details-scrim");
const detailsClose = document.querySelector(".details-drawer__close");
const detailsAtb = document.querySelector(".details-drawer__atb");
const drawerTitleEl = document.querySelector("#details-drawer-title");
const drawerDetailsEl = document.querySelector("[data-drawer-field='details']");
const drawerFooterTitleEl = document.querySelector(
  "[data-drawer-field='footerTitle']"
);
const drawerPriceEl = document.querySelector("[data-drawer-field='price']");
const desktopMq = window.matchMedia("(min-width: 860px)");
const viewAll = document.querySelector(".view-all");
const quickAdd = document.querySelector(".quick-add");
const plusIcon = document.querySelector('.quick-add__icon[data-state="plus"]');
const checkIcon = document.querySelector('.quick-add__icon[data-state="check"]');
const status = document.querySelector("#status");
const titleEl = document.querySelector('[data-field="title"]');
const descriptionEl = document.querySelector('[data-field="description"]');
const cardTitleEl = document.querySelector('[data-field="cardTitle"]');
const priceEl = document.querySelector('[data-field="price"]');
const thumbEl = document.querySelector('[data-field="thumb"]');
const assetBase = (() => {
  const script = document.querySelector('script[src*="app.js"]');
  return script ? new URL(".", script.src).href : "";
})();

function assetUrl(path) {
  return assetBase ? new URL(path, assetBase).href : path;
}

const added = {
  set: false,
  0: false,
  1: false,
  2: false,
  3: false,
};

let step = "set";
let copyTimer = 0;
let drawerTimer = 0;
let stepMetrics = null;
let drag = null;
let suppressClick = false;

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function copyDelay() {
  if (reduceMotion()) return 0;
  const raw = getComputedStyle(highlight).getPropertyValue("--copy-duration");
  return Number.parseFloat(raw) || 280;
}

function currentKey() {
  return step === "set" ? "set" : step;
}

function currentProduct() {
  return step === "set" ? SET : PRODUCTS[Number(step)];
}

function isDesktop() {
  return desktopMq.matches;
}

function productDetailsText(product = currentProduct()) {
  return product.details || product.description;
}

function isDrawerOpen() {
  return detailsOverlay.classList.contains("is-open");
}

function syncDetailsTrigger() {
  detailsLink.setAttribute("aria-controls", "details-drawer");
}

function renderDrawer() {
  const product = currentProduct();
  drawerTitleEl.textContent = product.title;
  drawerFooterTitleEl.textContent = product.title;
  drawerPriceEl.textContent = product.price;
  drawerDetailsEl.textContent = productDetailsText(product);
  detailsAtb.textContent = added[currentKey()] ? "Added" : "Add to bag";
}

function openDetailsDrawer() {
  renderDrawer();
  window.clearTimeout(drawerTimer);
  detailsOverlay.hidden = false;
  detailsOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-details-open");
  detailsLink.setAttribute("aria-expanded", "true");
  syncDetailsTrigger();

  if (reduceMotion()) {
    detailsOverlay.classList.add("is-open");
    detailsClose.focus();
    return;
  }

  requestAnimationFrame(() => {
    detailsOverlay.classList.add("is-open");
    detailsClose.focus();
  });
}

function closeDetailsDrawer({ restoreFocus = true } = {}) {
  if (detailsOverlay.hidden && !isDrawerOpen()) return;

  detailsOverlay.classList.remove("is-open");
  document.body.classList.remove("is-details-open");
  detailsLink.setAttribute("aria-expanded", "false");

  const hide = () => {
    detailsOverlay.hidden = true;
    detailsOverlay.setAttribute("aria-hidden", "true");
    if (restoreFocus) detailsLink.focus();
  };

  if (reduceMotion()) {
    hide();
    return;
  }

  window.clearTimeout(drawerTimer);
  drawerTimer = window.setTimeout(hide, 700);
}

function closeInlineDetails() {
  details.setAttribute("hidden", "");
  if (!isDrawerOpen()) {
    detailsLink.setAttribute("aria-expanded", "false");
  }
}

function renderCopy() {
  const product = currentProduct();
  titleEl.textContent = product.title;
  descriptionEl.textContent = product.description;
  cardTitleEl.textContent = product.cardTitle;
  priceEl.textContent = product.price;
  thumbEl.src = assetUrl(product.thumb);
  thumbEl.width = product.thumbSize[0];
  thumbEl.height = product.thumbSize[1];
  thumbEl.alt =
    step === "set" ? "The FFFull Set bottles" : `${product.label} bottle`;

  if (isDrawerOpen()) renderDrawer();
}

function renderAdded() {
  const isAdded = added[currentKey()];
  quickAdd.classList.toggle("is-added", isAdded);
  quickAdd.setAttribute("aria-pressed", String(isAdded));
  quickAdd.setAttribute("aria-label", `Add ${currentProduct().label} to bag`);
  plusIcon.hidden = isAdded;
  checkIcon.hidden = !isAdded;
  detailsAtb.textContent = isAdded ? "Added" : "Add to bag";
}

function setStep(next) {
  if (next === step) return;

  step = next;
  highlight.dataset.step = next;

  bottles.forEach((bottle) => {
    const active = next !== "set" && bottle.dataset.index === String(next);
    bottle.classList.toggle("is-active", active);
    bottle.setAttribute("aria-pressed", String(active));
  });

  closeInlineDetails();

  const delay = copyDelay();
  highlight.classList.add("is-switching");
  window.clearTimeout(copyTimer);

  copyTimer = window.setTimeout(() => {
    renderCopy();
    renderAdded();
    requestAnimationFrame(() => {
      highlight.classList.remove("is-switching");
    });
  }, delay);
}

bottles.forEach((bottle) => {
  bottle.addEventListener("click", (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setStep(bottle.dataset.index);
  });
});

viewAll.addEventListener("click", () => {
  setStep("set");
});

detailsLink.addEventListener("click", () => {
  if (isDrawerOpen()) {
    closeDetailsDrawer();
  } else {
    openDetailsDrawer();
  }
});

detailsScrim.addEventListener("click", () => {
  closeDetailsDrawer();
});

detailsClose.addEventListener("click", () => {
  closeDetailsDrawer();
});

detailsAtb.addEventListener("click", () => {
  quickAdd.click();
});

document.addEventListener("keydown", (event) => {
  if (!isDrawerOpen()) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeDetailsDrawer();
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = [detailsClose, detailsAtb];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && (active === first || !detailsDrawer.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !detailsDrawer.contains(active))) {
    event.preventDefault();
    first.focus();
  }
});

quickAdd.addEventListener("click", () => {
  const key = currentKey();
  added[key] = !added[key];
  renderAdded();
  status.textContent = added[key]
    ? `${currentProduct().label} added to bag`
    : `${currentProduct().label} removed from bag`;
});

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function stepIndex(key = step) {
  return STEPS.indexOf(key);
}

function neighborStep(from, direction) {
  const next = stepIndex(from) + direction;
  if (next < 0 || next >= STEPS.length) return from;
  return STEPS[next];
}

function snapDistance() {
  const width = hero.getBoundingClientRect().width;
  return Math.min(SNAP_MAX, Math.max(SNAP_MIN, width * SNAP_RATIO));
}

function scrubRange() {
  return Math.max(snapDistance() * 1.35, hero.getBoundingClientRect().width * 0.22);
}

function cacheStepMetrics() {
  const probe = document.createElement("div");
  probe.className = "highlight";
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;left:-9999px;visibility:hidden;pointer-events:none;";
  document.body.append(probe);

  const metrics = {};
  for (const key of STEPS) {
    probe.dataset.step = key;
    const styles = getComputedStyle(probe);
    metrics[key] = {
      scrollX: Number.parseFloat(styles.getPropertyValue("--scroll-x")) || 0,
      gap: Number.parseFloat(styles.getPropertyValue("--bottle-gap")) || 0,
    };
  }

  probe.remove();
  stepMetrics = metrics;
}

function ensureMetrics() {
  if (!stepMetrics) cacheStepMetrics();
}

function clearScrubStyles() {
  highlight.style.removeProperty("--scroll-x");
  highlight.style.removeProperty("--bottle-gap");
}

function setScrubbing(on) {
  bottlesRow.style.transition = on ? "none" : "";
}

function applyScrub(deltaX) {
  if (reduceMotion()) return;
  ensureMetrics();

  const from = stepMetrics[step];
  if (!from) return;

  if (deltaX === 0) {
    highlight.style.setProperty("--scroll-x", `${from.scrollX}px`);
    highlight.style.setProperty("--bottle-gap", `${from.gap}px`);
    return;
  }

  const direction = deltaX < 0 ? 1 : -1;
  const targetKey = neighborStep(step, direction);

  if (targetKey === step) {
    const resist = Math.max(-36, Math.min(36, deltaX)) * 0.25;
    highlight.style.setProperty("--scroll-x", `${from.scrollX + resist}px`);
    highlight.style.setProperty("--bottle-gap", `${from.gap}px`);
    return;
  }

  const to = stepMetrics[targetKey];
  const progress = Math.min(Math.abs(deltaX) / scrubRange(), 1);
  highlight.style.setProperty(
    "--scroll-x",
    `${lerp(from.scrollX, to.scrollX, progress)}px`
  );
  highlight.style.setProperty(
    "--bottle-gap",
    `${lerp(from.gap, to.gap, progress)}px`
  );
}

function endDrag(deltaX) {
  hero.classList.remove("is-dragging");
  setScrubbing(false);

  const direction = deltaX < 0 ? 1 : -1;
  const targetKey = neighborStep(step, direction);
  const shouldSnap =
    Math.abs(deltaX) >= snapDistance() && targetKey !== step;

  if (shouldSnap) setStep(targetKey);

  if (reduceMotion()) {
    clearScrubStyles();
    return;
  }

  requestAnimationFrame(() => {
    clearScrubStyles();
  });
}

function armClickSuppression() {
  suppressClick = true;
  window.setTimeout(() => {
    suppressClick = false;
  }, 0);
}

hero.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    dragging: false,
  };
});

hero.addEventListener(
  "pointermove",
  (event) => {
    if (!drag || event.pointerId !== drag.id) return;

    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;

    if (!drag.dragging) {
      if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        drag = null;
        return;
      }

      drag.dragging = true;
      hero.classList.add("is-dragging");
      try {
        hero.setPointerCapture(event.pointerId);
      } catch {
        // Capture can fail if the pointer was released early.
      }
      if (!reduceMotion()) {
        ensureMetrics();
        setScrubbing(true);
      }
    }

    if (event.cancelable) event.preventDefault();
    applyScrub(deltaX);
  },
  { passive: false }
);

function finishPointer(event) {
  if (!drag || event.pointerId !== drag.id) return;

  const deltaX = event.clientX - drag.x;
  const wasDragging = drag.dragging;
  drag = null;

  if (!wasDragging) return;

  armClickSuppression();
  endDrag(deltaX);
}

hero.addEventListener("pointerup", finishPointer);
hero.addEventListener("pointercancel", finishPointer);

hero.addEventListener("lostpointercapture", (event) => {
  if (!drag || event.pointerId !== drag.id || !drag.dragging) return;
  const deltaX = event.clientX - drag.x;
  drag = null;
  armClickSuppression();
  endDrag(deltaX);
});

document.addEventListener(
  "click",
  (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true
);

bottlesRow.addEventListener("dragstart", (event) => {
  event.preventDefault();
});

window.addEventListener("resize", () => {
  stepMetrics = null;
});

desktopMq.addEventListener("change", () => {
  stepMetrics = null;
  closeInlineDetails();
  syncDetailsTrigger();
});

syncDetailsTrigger();

