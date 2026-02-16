// Telegram init
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// Если фронт открывается с домена Render (you-tube-app.onrender.com) — можно делать запросы относительными.
// Если фронт где-то ещё (например, Vercel) — оставляем абсолютный Render-URL.
const IS_RENDER = window.location.hostname.endsWith("onrender.com");
const API_BASE = IS_RENDER ? "" : "https://you-tube-app.onrender.com";

// Навигация
const tabs = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");

function goTo(pageName) {
  tabs.forEach(b => b.classList.toggle("active", b.dataset.to === pageName));
  pages.forEach(p => p.classList.toggle("active", p.dataset.page === pageName));
}
tabs.forEach(btn => btn.addEventListener("click", () => goTo(btn.dataset.to)));

// Элементы UI
const qEl = document.getElementById("searchInput");
const list = document.getElementById("list");
const statusEl = document.getElementById("status");
const playerWrap = document.getElementById("playerWrap");
const player = document.getElementById("player");

// Контакты (поменяй USERNAME)
document.getElementById("contactLink")?.addEventListener("click", (e) => {
  e.preventDefault();
  const url = "https://t.me/USERNAME";
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
});

function setStatus(t) {
  if (statusEl) statusEl.textContent = t || "";
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function render(items) {
  list.innerHTML = "";
  items.forEach(it => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <img class="thumb" src="${esc(it.thumbnail)}" />
      <div class="cardBody">
        <div class="title">${esc(it.title)}</div>
        <div class="muted">${esc(it.channelTitle)}</div>
      </div>
    `;
    div.onclick = () => openVideo(it.videoId);
    list.appendChild(div);
  });
}

function closePlayer() {
  player.src = "";
  playerWrap.style.display = "none";
  if (tg?.BackButton) tg.BackButton.hide();
}

const backHandler = () => closePlayer();

function openVideo(videoId) {
  playerWrap.style.display = "block";
  player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`;

  if (tg?.BackButton) {
    tg.BackButton.show();
    tg.BackButton.offClick?.(backHandler);
    tg.BackButton.onClick(backHandler);
  }
}

async function loadPopular() {
  goTo("home");
  closePlayer();
  setStatus("Загружаю популярное…");

  try {
    const r = await fetch(`${API_BASE}/popular?region=RU&max_results=12`);
    const data = await r.json();
    render(data.items || []);
    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus("Ошибка популярного. Проверь /popular на бэкенде.");
  }
}

async function doSearch(q) {
  goTo("home");
  closePlayer();
  setStatus("Ищу…");

  try {
    const r = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&max_results=12`);
    const data = await r.json();
    render(data.items || []);
    setStatus((data.items && data.items.length) ? "" : "Ничего не найдено");
  } catch (e) {
    console.error(e);
    setStatus("Ошибка поиска. Проверь /search на бэкенде.");
  }
}

// debounce (чтобы не спамить API)
let t = null;
qEl?.addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(() => {
    const q = qEl.value.trim();
    if (!q) return loadPopular();
    if (q.length < 2) return;
    doSearch(q);
  }, 350);
});

qEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = qEl.value.trim();
    if (!q) loadPopular();
    else doSearch(q);
  }
});

// Старт: сразу показываем популярное
loadPopular();