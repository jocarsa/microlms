"use strict";

const $ = (sel) => document.querySelector(sel);

// Views
const authView = $("#authView");
const appView = $("#appView");
const searchBar = $("#searchBar");

// Auth UI
const uEl = $("#user");
const pEl = $("#pass");
const loginBtn = $("#loginBtn");
const authErr = $("#authErr");

// App UI
const grid = $("#grid");
const q = $("#q");
const meta = $("#meta");
const empty = $("#empty");

// Modal
const modal = $("#modal");
const modalTitle = $("#modalTitle");
const player = $("#player");

let allVideos = [];

// Simple session flag (refresh-safe). This is NOT secure, just convenience.
const SESSION_KEY = "micro_lms_authed";

function bytesToHuman(n) {
  const units = ["B","KB","MB","GB","TB"];
  let i = 0;
  let x = Number(n || 0);
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
function secondsToHuman(s) {
  s = Number(s || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  if (m <= 0) return `${r}s`;
  return `${m}m ${String(r).padStart(2,"0")}s`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function cardTemplate(v) {
  const thumb = v.thumbnail_file ? v.thumbnail_file : "";
  const bg = thumb
    ? `style="background-image:url('${encodeURI(thumb)}')"`
    : `style="background-image:linear-gradient(135deg, rgba(37,99,235,.14), rgba(99,102,241,.14))"`;

  const sub = `${secondsToHuman(v.duration_seconds)} · ${bytesToHuman(v.size_bytes)}`;

  return `
    <article class="card" tabindex="0" role="button"
      aria-label="Play ${escapeHtml(v.title)}"
      data-video="${escapeAttr(v.video_file)}"
      data-title="${escapeAttr(v.title)}">
      <div class="card__bg" ${bg}></div>
      <div class="card__shade"></div>
      <div class="card__body">
        <div class="card__title">${escapeHtml(v.title)}</div>
        <div class="card__sub">${escapeHtml(sub)}</div>
      </div>
    </article>
  `;
}

function render(list) {
  grid.innerHTML = list.map(cardTemplate).join("");
  empty.hidden = list.length !== 0;
  meta.textContent = `${list.length} / ${allVideos.length}`;

  grid.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openFromCard(card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFromCard(card);
      }
    });
  });
}

function openFromCard(card) {
  const videoFile = card.getAttribute("data-video") || "";
  const title = card.getAttribute("data-title") || "Video";

  modalTitle.textContent = title;

  player.pause();
  player.removeAttribute("src");
  player.load();

  player.src = videoFile;
  openModal();
}

function openModal() {
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  player.play().catch(() => {});
}

function closeModal() {
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  player.pause();
  player.removeAttribute("src");
  player.load();
}

function applyFilter() {
  const term = (q.value || "").trim().toLowerCase();
  if (!term) return render(allVideos);
  const filtered = allVideos.filter(v => String(v.title || "").toLowerCase().includes(term));
  render(filtered);
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return await res.json();
}

async function loadCatalog() {
  const data = await loadJson("videos.json");
  allVideos = Array.isArray(data.videos) ? data.videos : [];
  render(allVideos);
}

function wireModalClose() {
  modal.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") closeModal();
  });
}

/* =========================
   AUTH (client-side gate)
========================= */
function showAuth(error = false) {
  authView.hidden = false;
  appView.hidden = true;
  searchBar.hidden = true;
  authErr.hidden = !error;
  uEl.focus();
}

function showApp() {
  authView.hidden = true;
  appView.hidden = false;
  searchBar.hidden = false;
  authErr.hidden = true;
}

async function attemptLogin() {
  authErr.hidden = true;

  const inputUser = (uEl.value || "").trim();
  const inputPass = (pEl.value || "");

  let creds;
  try {
    creds = await loadJson("auth.json");
  } catch (e) {
    console.error(e);
    authErr.hidden = false;
    authErr.textContent = "auth.json missing or not readable.";
    return;
  }

  const ok = inputUser === String(creds.user || "") && inputPass === String(creds.pass || "");
  if (!ok) {
    showAuth(true);
    return;
  }

  localStorage.setItem(SESSION_KEY, "1");
  showApp();

  try {
    await loadCatalog();
    meta.textContent = `${allVideos.length} / ${allVideos.length}`;
  } catch (e) {
    console.error(e);
    meta.textContent = "Failed to load videos.json";
    empty.hidden = false;
    empty.textContent = "Could not load videos.json. Use a local web server.";
  }
}

function isAuthed() {
  return localStorage.getItem(SESSION_KEY) === "1";
}

function wireAuth() {
  loginBtn.addEventListener("click", attemptLogin);
  pEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptLogin();
  });
  uEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptLogin();
  });
}

/* =========================
   INIT
========================= */
(function init(){
  wireModalClose();
  wireAuth();

  if (q) q.addEventListener("input", applyFilter);

  if (isAuthed()) {
    showApp();
    loadCatalog().catch((err) => {
      console.error(err);
      meta.textContent = "Failed to load videos.json";
      empty.hidden = false;
      empty.textContent = "Could not load videos.json. Use a local web server.";
    });
  } else {
    showAuth(false);
  }
})();

