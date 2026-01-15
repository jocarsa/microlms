"use strict";

const $ = (sel) => document.querySelector(sel);

const grid = $("#grid");
const q = $("#q");
const meta = $("#meta");
const empty = $("#empty");

const modal = $("#modal");
const modalTitle = $("#modalTitle");
const player = $("#player");

let allVideos = [];

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

function cardTemplate(v) {
  const thumb = v.thumbnail_file ? v.thumbnail_file : "";
  const bg = thumb
    ? `style="background-image:url('${encodeURI(thumb)}')"`
    : `style="background-image:linear-gradient(135deg, rgba(96,165,250,.18), rgba(167,139,250,.18))"`;

  const sub = `${secondsToHuman(v.duration_seconds)} · ${bytesToHuman(v.size_bytes)}`;

  return `
    <article class="card" tabindex="0" role="button" aria-label="Play ${escapeHtml(v.title)}" data-video="${escapeAttr(v.video_file)}" data-title="${escapeAttr(v.title)}">
      <div class="card__bg" ${bg}></div>
      <div class="card__shade"></div>
      <div class="card__body">
        <div class="card__title">${escapeHtml(v.title)}</div>
        <div class="card__sub">${escapeHtml(sub)}</div>
      </div>
    </article>
  `;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function render(list) {
  grid.innerHTML = list.map(cardTemplate).join("");
  empty.hidden = list.length !== 0;
  meta.textContent = `${list.length} / ${allVideos.length}`;

  // click handlers
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

  // Set source
  player.pause();
  player.removeAttribute("src");
  player.load();

  player.src = videoFile;
  openModal();
}

function openModal() {
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  // try to autoplay (may be blocked; user can press play)
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
  if (!term) {
    render(allVideos);
    return;
  }
  const filtered = allVideos.filter(v => String(v.title || "").toLowerCase().includes(term));
  render(filtered);
}

async function loadJson() {
  const res = await fetch("videos.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load videos.json (${res.status})`);
  const data = await res.json();
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

(function init(){
  wireModalClose();
  q.addEventListener("input", applyFilter);

  loadJson().catch((err) => {
    console.error(err);
    meta.textContent = "Failed to load videos.json";
    empty.hidden = false;
    empty.textContent = "Could not load videos.json. If you opened index.html directly, use a local web server.";
  });
})();

