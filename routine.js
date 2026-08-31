const root = document.querySelector(".routine");
const steps = [...document.querySelectorAll(".routine-step")];
const heads = [...document.querySelectorAll(".routine-step__head")];
const thumbs = [...document.querySelectorAll(".routine-thumb")];
const phases = [...document.querySelectorAll("[data-phase]")];
const products = [...document.querySelectorAll("[data-product]")];
const playBtn = document.querySelector("[data-play]");
const video = document.querySelector("[data-hero]");

const STEP_ORDER = ["cleanse", "balance", "treat", "protect"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function applyStep(name) {
  if (!STEP_ORDER.includes(name)) return;
  root.dataset.step = name;

  steps.forEach((step) => {
    const on = step.dataset.step === name;
    const head = step.querySelector(".routine-step__head");
    const panel = step.querySelector(".routine-step__body");
    step.classList.toggle("is-open", on);
    if (head) {
      head.setAttribute("aria-selected", on ? "true" : "false");
      head.setAttribute("aria-expanded", on ? "true" : "false");
    }
    if (panel) {
      panel.setAttribute("aria-hidden", on ? "false" : "true");
      panel.inert = !on;
    }
  });

  thumbs.forEach((thumb) => {
    const on = thumb.dataset.step === name;
    thumb.classList.toggle("is-on", on);
    thumb.setAttribute("aria-pressed", on ? "true" : "false");
  });

  phases.forEach((icon) => {
    icon.classList.toggle("is-on", icon.dataset.phase === name);
  });

  products.forEach((img) => {
    img.classList.toggle("is-on", img.dataset.product === name);
  });

  const product = document.querySelector(".routine-product");
  const active = products.find((img) => img.dataset.product === name);
  if (product && active) {
    product.style.backgroundImage = 'url("' + active.getAttribute("src") + '")';
  }
}

function setPlaying(on) {
  root.dataset.playing = on ? "true" : "false";
  if (playBtn) {
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
  }
}

function togglePlay() {
  if (!video) return;
  if (video.paused) video.play();
  else video.pause();
}

heads.forEach((head) => {
  head.addEventListener("click", () => {
    const step = head.closest(".routine-step");
    if (step) applyStep(step.dataset.step);
  });
});

thumbs.forEach((thumb) => {
  thumb.addEventListener("click", () => applyStep(thumb.dataset.step));
});

if (playBtn) {
  playBtn.addEventListener("click", togglePlay);
}

if (video) {
  video.addEventListener("play", () => setPlaying(true));
  video.addEventListener("pause", () => setPlaying(false));
  if (reduceMotion) {
    video.removeAttribute("autoplay");
    video.pause();
    setPlaying(false);
  } else {
    const playAttempt = video.play();
    if (playAttempt && playAttempt.catch) {
      playAttempt.catch(() => setPlaying(false));
    }
  }
}

const hash = location.hash.replace("#", "");
applyStep(STEP_ORDER.includes(hash) ? hash : root.dataset.step || "cleanse");
