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
let flyEl = null;
let morphGen = 0;
let morphTimer = 0;
let morphing = false;
let viewGen = 0;
let switchGen = 0;

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

function writeMember(i) {
  const member = memberAt(i);
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
}

function applyMember(i, { silent = false } = {}) {
  if (!silent && isDetail() && !reduceMotion()) {
    switchMember(i);
    return;
  }
  writeMember(i);
}

async function switchMember(i) {
  if (!isDetail()) {
    writeMember(i);
    return;
  }
  if (i === index) return;
  if (reduceMotion()) {
    writeMember(i);
    return;
  }

  const token = ++switchGen;
  viewGen += 1;
  clearViewMotion();
  community.classList.add("is-switching", "is-switching-member");

  const alive = () => token === switchGen && isDetail();
  const columnFade = motionMs("--community-column", 300);

  const finish = () => {
    community.classList.remove(
      "is-switching",
      "is-switching-member",
      "is-exiting-detail",
      "is-entering-detail",
      "is-fade-ready",
      "is-left-in",
      "is-center-in",
      "is-right-in",
      "is-right-out",
      "is-center-out",
      "is-left-out",
      "is-top-in",
      "is-bottom-in",
      "is-top-out",
      "is-bottom-out"
    );
  };

  // Fade out: desktop right → left, mobile top → bottom
  community.classList.add("is-exiting-detail");
  if (isDesktop()) {
    community.classList.add("is-right-out");
    await sleep(columnFade);
    if (!alive()) {
      finish();
      return;
    }
    community.classList.add("is-center-out");
    await sleep(columnFade);
    if (!alive()) {
      finish();
      return;
    }
    community.classList.add("is-left-out");
    await sleep(columnFade);
    if (!alive()) {
      finish();
      return;
    }
  } else {
    community.classList.add("is-top-out");
    await sleep(columnFade);
    if (!alive()) {
      finish();
      return;
    }
    community.classList.add("is-bottom-out");
    await sleep(columnFade);
    if (!alive()) {
      finish();
      return;
    }
  }

  writeMember(i);

  // Hold hidden, then fade in: desktop left → right, mobile top → bottom
  community.classList.remove(
    "is-exiting-detail",
    "is-right-out",
    "is-center-out",
    "is-left-out",
    "is-top-out",
    "is-bottom-out"
  );
  community.classList.add("is-entering-detail");
  await new Promise((resolve) => afterTwoFrames(resolve));
  if (!alive()) {
    finish();
    return;
  }

  community.classList.add("is-fade-ready");
  await new Promise((resolve) => afterTwoFrames(resolve));
  if (!alive()) {
    finish();
    return;
  }

  if (isDesktop()) {
    community.classList.add("is-left-in");
    await sleep(columnFade);
    if (!alive()) {
      finish();
      return;
    }
    community.classList.add("is-center-in");
    await sleep(columnFade);
    if (!alive()) {
      finish();
      return;
    }
    community.classList.add("is-right-in");
    await sleep(columnFade);
  } else {
    community.classList.add("is-top-in");
    await sleep(columnFade);
    if (!alive()) {
      finish();
      return;
    }
    community.classList.add("is-bottom-in");
    await sleep(columnFade);
  }

  if (!alive()) {
    finish();
    return;
  }
  finish();
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

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function motionMs(name, fallback) {
  return cssTimeMs(name, fallback);
}

function clearCardDelays() {
  cards.forEach((card) => {
    card.style.transitionDelay = "";
  });
}

function randomCardDelays() {
  const stagger = motionMs("--community-stagger", 70);
  const order = cards.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  order.forEach((cardIndex, step) => {
    cards[cardIndex].style.transitionDelay = `${step * stagger}ms`;
  });
  return (cards.length - 1) * stagger;
}

function clearViewMotion() {
  community.classList.remove(
    "is-exiting-grid",
    "is-entering-detail",
    "is-fade-ready",
    "is-left-in",
    "is-center-in",
    "is-right-in",
    "is-right-out",
    "is-center-out",
    "is-left-out",
    "is-top-in",
    "is-bottom-in",
    "is-bottom-out",
    "is-top-out",
    "is-exiting-detail",
    "is-entering-grid",
    "is-grid-in",
    "is-switching-member"
  );
  clearCardDelays();
}

async function revealDetailColumns(alive) {
  community.classList.remove(
    "is-exiting-detail",
    "is-right-out",
    "is-center-out",
    "is-left-out",
    "is-bottom-out",
    "is-top-out",
    "is-left-in",
    "is-center-in",
    "is-right-in",
    "is-top-in",
    "is-bottom-in"
  );
  community.classList.add("is-entering-detail");
  await new Promise((resolve) => afterTwoFrames(resolve));
  if (!alive()) return false;

  community.classList.add("is-fade-ready");
  await new Promise((resolve) => afterTwoFrames(resolve));
  if (!alive()) return false;

  const columnFade = motionMs("--community-column", 300);
  const columnStep = motionMs("--community-column-step", 160);

  if (isDesktop()) {
    community.classList.add("is-left-in");
    await sleep(columnStep);
    if (!alive()) return false;

    community.classList.add("is-center-in");
    await sleep(columnStep);
    if (!alive()) return false;

    community.classList.add("is-right-in");
    await sleep(columnFade);
    if (!alive()) return false;

    community.classList.remove(
      "is-entering-detail",
      "is-fade-ready",
      "is-left-in",
      "is-center-in",
      "is-right-in"
    );
  } else {
    community.classList.add("is-top-in");
    await sleep(columnStep);
    if (!alive()) return false;

    community.classList.add("is-bottom-in");
    await sleep(columnFade);
    if (!alive()) return false;

    community.classList.remove(
      "is-entering-detail",
      "is-fade-ready",
      "is-top-in",
      "is-bottom-in"
    );
  }

  return true;
}

async function concealDetailColumns(alive, { holdHidden = false } = {}) {
  community.classList.remove(
    "is-entering-detail",
    "is-fade-ready",
    "is-left-in",
    "is-center-in",
    "is-right-in",
    "is-top-in",
    "is-bottom-in"
  );

  const columnFade = motionMs("--community-column", 300);
  const columnStep = motionMs("--community-column-step", 160);

  if (isDesktop()) {
    community.classList.add("is-exiting-detail", "is-right-out");
    await sleep(columnStep);
    if (!alive()) return false;

    community.classList.add("is-center-out");
    await sleep(columnStep);
    if (!alive()) return false;

    community.classList.add("is-left-out");
    await sleep(columnFade);
    if (!alive()) return false;

    if (!holdHidden) {
      community.classList.remove(
        "is-exiting-detail",
        "is-right-out",
        "is-center-out",
        "is-left-out"
      );
    }
  } else {
    community.classList.add("is-exiting-detail", "is-bottom-out");
    await sleep(columnStep);
    if (!alive()) return false;

    community.classList.add("is-top-out");
    await sleep(columnFade);
    if (!alive()) return false;

    if (!holdHidden) {
      community.classList.remove(
        "is-exiting-detail",
        "is-bottom-out",
        "is-top-out"
      );
    }
  }

  return true;
}

async function openDetail(i) {
  if (isDetail()) return;

  const token = ++viewGen;
  switchGen += 1;
  cancelMorph();
  clearViewMotion();
  community.classList.remove("is-switching");

  writeMember(i);

  if (reduceMotion()) {
    setView("detail");
    pauseBtn.focus();
    return;
  }

  const cardSpan = randomCardDelays();
  community.classList.add("is-exiting-grid");
  await sleep(cardSpan + motionMs("--community-fade", 460));
  if (token !== viewGen) return;

  setView("detail");
  community.classList.remove("is-exiting-grid");
  clearCardDelays();

  const revealed = await revealDetailColumns(() => token === viewGen && isDetail());
  if (!revealed) return;

  pauseBtn.focus();
}

async function closeDetail() {
  if (!isDetail()) return;

  const token = ++viewGen;
  switchGen += 1;
  cancelMorph();
  clearViewMotion();
  community.classList.remove("is-paused", "is-switching");

  const card = cards[index];

  if (reduceMotion()) {
    setView("grid");
    card.querySelector(".media-control")?.focus();
    return;
  }

  const concealed = await concealDetailColumns(() => token === viewGen && isDetail());
  if (!concealed) return;

  setView("grid");
  const cardSpan = randomCardDelays();
  community.classList.add("is-entering-grid");
  await new Promise((resolve) => afterTwoFrames(resolve));
  if (token !== viewGen) return;

  community.classList.add("is-fade-ready");
  await new Promise((resolve) => afterTwoFrames(resolve));
  if (token !== viewGen) return;

  community.classList.add("is-grid-in");
  await sleep(cardSpan + motionMs("--community-fade-in", 640));
  if (token !== viewGen) return;

  community.classList.remove("is-entering-grid", "is-fade-ready", "is-grid-in");
  card.querySelector(".media-control")?.focus();
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
