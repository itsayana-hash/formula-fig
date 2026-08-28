const media = document.querySelector("[data-media]");
const lens = document.querySelector("[data-reveal]");

let dragging = false;
let raf = 0;
let posX = 0;
let posY = 0;

function isDesktop() {
  return window.matchMedia("(min-width: 860px)").matches;
}

function revealSize() {
  return lens.offsetWidth || 146;
}

function setReveal(clientX, clientY) {
  const rect = media.getBoundingClientRect();
  const size = revealSize();
  posX = clientX - rect.left - size / 2;
  posY = clientY - rect.top - size / 2;
  if (!raf) raf = requestAnimationFrame(paint);
}

function paint() {
  raf = 0;
  media.style.setProperty("--reveal-x", `${posX}px`);
  media.style.setProperty("--reveal-y", `${posY}px`);
}

function showReveal() {
  media.classList.add("is-revealing");
}

function hideReveal() {
  dragging = false;
  media.classList.remove("is-revealing");
}

function onPointerMove(event) {
  if (isDesktop()) {
    setReveal(event.clientX, event.clientY);
    return;
  }
  if (!dragging) return;
  event.preventDefault();
  setReveal(event.clientX, event.clientY);
}

function onPointerEnter(event) {
  if (!isDesktop()) return;
  showReveal();
  setReveal(event.clientX, event.clientY);
}

function onPointerLeave() {
  if (!isDesktop()) return;
  hideReveal();
}

function onPointerDown(event) {
  if (isDesktop()) return;
  dragging = true;
  media.setPointerCapture(event.pointerId);
  showReveal();
  setReveal(event.clientX, event.clientY);
}

function onPointerUp(event) {
  if (isDesktop()) return;
  if (media.hasPointerCapture(event.pointerId)) {
    media.releasePointerCapture(event.pointerId);
  }
  hideReveal();
}

media.addEventListener("pointerenter", onPointerEnter);
media.addEventListener("pointerleave", onPointerLeave);
media.addEventListener("pointermove", onPointerMove, { passive: false });
media.addEventListener("pointerdown", onPointerDown);
media.addEventListener("pointerup", onPointerUp);
media.addEventListener("pointercancel", onPointerUp);
media.addEventListener("lostpointercapture", () => {
  if (!isDesktop()) hideReveal();
});

window.matchMedia("(min-width: 860px)").addEventListener("change", hideReveal);
