const desktopMq = window.matchMedia("(min-width: 860px)");

const community = document.querySelector(".community");
const grid = document.querySelector(".community-grid");
const cards = [...document.querySelectorAll(".community-card")];
const detail = document.querySelector(".community-detail");
const thumbsRoot = document.querySelector("[data-thumbs]");
const viewAll = document.querySelector("[data-view-all]");
const pauseBtn = document.querySelector("[data-pause]");
const portraitEl = document.querySelector("[data-detail='portrait']");
const heroEl = document.querySelector("[data-detail='hero']");
const detailsEl = document.querySelector("[data-detail='details']");
const figbarEl = document.querySelector("[data-detail='figbar']");
const tickerDetails = document.querySelectorAll("[data-ticker='details'], [data-ticker='details-dup']");
const tickerFigbar = document.querySelectorAll("[data-ticker='figbar'], [data-ticker='figbar-dup']");

const members = cards.map((card) => {
  const img = card.querySelector(":scope > img");
  return {
    details: card.dataset.details,
    figbar: card.dataset.figbar,
    portrait: img.src,
    alt: img.alt,
    hero: card.dataset.hero || img.getAttribute("src"),
    width: img.getAttribute("width"),
    height: img.getAttribute("height"),
  };
});

let index = 0;
let playing = true;
let copyTimer = 0;
let flyEl = null;
let morphGen = 0;
let morphTimer = 0;
let morphing = false;
let viewGen = 0;

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isDetail() {
  return community.dataset.view === "detail";
}

function isDesktop() {
  return desktopMq.matches;
}

function cssTimeMs(name, fallback) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (raw.endsWith("ms")) return parseFloat(raw) || fallback;
  if (raw.endsWith("s")) return parseFloat(raw) * 1000 || fallback;
  return fallback;
}

function flyDurationMs() {
  return cssTimeMs("--fly-duration", 720);
}

function copyDurationMs() {
  return cssTimeMs("--copy-duration", 500);
}

function memberAt(i) {
  return members[i];
}

function renderThumbs() {
  thumbsRoot.replaceChildren(
    ...members.map((member, i) => {
      const button = document.createElement("button");
      button.className = "detail-thumb";
      button.type = "button";
      button.dataset.index = String(i);
      button.setAttribute("aria-label", `Show ${member.details}`);
      button.setAttribute("aria-pressed", i === index ? "true" : "false");
      if (i === index) button.classList.add("is-selected");

      const img = document.createElement("img");
      img.src = member.portrait;
      img.alt = "";
      img.width = Number(member.width);
      img.height = Number(member.height);

      const blinker = document.createElement("span");
      blinker.className = "blinker";
      blinker.setAttribute("aria-hidden", "true");

      button.append(img, blinker);
      return button;
    })
  );
}

function applyMember(i, { silent = false } = {}) {
  const member = memberAt(i);
  const fade = !silent && isDetail() && !reduceMotion();

  const write = () => {
    index = i;
    const cardImg = cards[i].querySelector(":scope > img");
    portraitEl.src = member.portrait;
    portraitEl.width = Number(member.width);
    portraitEl.height = Number(member.height);
    portraitEl.style.objectPosition = getComputedStyle(cardImg).objectPosition;
    heroEl.src = member.hero;
    heroEl.alt = member.alt;
    detailsEl.textContent = member.details;
    figbarEl.textContent = member.figbar;
    tickerDetails.forEach((el) => {
      el.textContent = member.details;
    });
    tickerFigbar.forEach((el) => {
      el.textContent = member.figbar;
    });
    community.dataset.index = String(i);
    thumbsRoot.querySelectorAll(".detail-thumb").forEach((thumb, t) => {
      const selected = t === i;
      thumb.classList.toggle("is-selected", selected);
      thumb.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  };

  if (!fade) {
    write();
    return;
  }

  community.classList.add("is-switching");
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    write();
    community.classList.remove("is-switching");
  }, copyDurationMs() / 2);
}

function setPlaying(next) {
  playing = next;
  pauseBtn.setAttribute("aria-pressed", playing ? "true" : "false");
  pauseBtn.setAttribute(
    "aria-label",
    playing ? "Pause community ticker" : "Play community ticker"
  );
  community.classList.toggle("is-paused", !playing);
}

function setView(view) {
  community.dataset.view = view;
  const detailOpen = view === "detail";
  grid.inert = detailOpen;
  detail.inert = !detailOpen;
  grid.setAttribute("aria-hidden", detailOpen ? "true" : "false");
  detail.setAttribute("aria-hidden", detailOpen ? "false" : "true");
}

function afterTwoFrames(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

function removeFly() {
  window.clearTimeout(morphTimer);
  flyEl?.remove();
  flyEl = null;
}

function endMorphClasses() {
  community.classList.remove("is-morphing");
  cards.forEach((card) => card.classList.remove("is-origin"));
}

function cancelMorph() {
  morphGen += 1;
  morphing = false;
  removeFly();
  endMorphClasses();
}

function makeFly(img, rect) {
  const fly = img.cloneNode(true);
  fly.removeAttribute("data-detail");
  fly.className = "community-fly";
  fly.alt = "";
  fly.setAttribute("aria-hidden", "true");
  fly.style.left = `${rect.left}px`;
  fly.style.top = `${rect.top}px`;
  fly.style.width = `${rect.width}px`;
  fly.style.height = `${rect.height}px`;
  fly.style.objectPosition = getComputedStyle(img).objectPosition;
  document.body.appendChild(fly);
  return fly;
}

function morph(fromRect, toRect, img, onDone) {
  const gen = ++morphGen;
  removeFly();

  if (
    fromRect.width < 2 ||
    fromRect.height < 2 ||
    toRect.width < 2 ||
    toRect.height < 2
  ) {
    morphing = false;
    endMorphClasses();
    onDone?.();
    return;
  }

  community.classList.add("is-morphing");
  morphing = true;

  const fly = makeFly(img, fromRect);
  flyEl = fly;
  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;
  const sx = toRect.width / fromRect.width;
  const sy = toRect.height / fromRect.height;

  let settled = false;
  const finish = () => {
    if (gen !== morphGen || settled) return;
    settled = true;
    morphing = false;
    endMorphClasses();
    const dropFly = () => {
      if (gen !== morphGen) return;
      if (flyEl === fly) {
        fly.remove();
        flyEl = null;
      }
      onDone?.();
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(dropFly);
    });
  };

  fly.addEventListener("transitionend", (event) => {
    if (event.propertyName === "transform") finish();
  });
  morphTimer = window.setTimeout(finish, flyDurationMs() + 80);

  fly.getBoundingClientRect();
  requestAnimationFrame(() => {
    if (gen !== morphGen) return;
    fly.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  });
}

function openDetail(i) {
  if (isDetail()) return;

  const token = ++viewGen;
  cancelMorph();

  const card = cards[i];
  const cardImg = card.querySelector(":scope > img");
  const fromRect = card.getBoundingClientRect();
  card.classList.add("is-origin");
  applyMember(i, { silent: true });
  setView("detail");

  const finishOpen = () => {
    if (token !== viewGen) return;
    pauseBtn.focus();
  };

  if (!isDesktop() || reduceMotion()) {
    card.classList.remove("is-origin");
    finishOpen();
    return;
  }

  afterTwoFrames(() => {
    if (token !== viewGen || !isDetail()) return;
    const toRect = portraitEl.parentElement.getBoundingClientRect();
    morph(fromRect, toRect, cardImg, finishOpen);
  });
}

function closeDetail() {
  if (!isDetail()) return;

  const token = ++viewGen;

  const card = cards[index];
  const fromRect = portraitEl.parentElement.getBoundingClientRect();
  const toRect = card.getBoundingClientRect();

  card.classList.add("is-origin");
  setView("grid");
  community.classList.remove("is-paused", "is-switching");

  const finishClose = () => {
    if (token !== viewGen) return;
    card.querySelector(".media-control")?.focus();
  };

  if (!isDesktop() || reduceMotion()) {
    cancelMorph();
    finishClose();
    return;
  }

  morph(fromRect, toRect, portraitEl, finishClose);
}

renderThumbs();
applyMember(0, { silent: true });

grid.addEventListener("click", (event) => {
  const card = event.target.closest(".community-card");
  if (!card) return;
  event.preventDefault();
  openDetail(Number(card.dataset.index));
});

thumbsRoot.addEventListener("click", (event) => {
  const thumb = event.target.closest(".detail-thumb");
  if (!thumb) return;
  applyMember(Number(thumb.dataset.index));
});

viewAll.addEventListener("click", () => {
  closeDetail();
});

pauseBtn.addEventListener("click", () => {
  setPlaying(!playing);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isDetail()) closeDetail();
});
