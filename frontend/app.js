const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ====== ТВОЯ ОБРАТНАЯ СВЯЗЬ (МЕНЯЕШЬ ТУТ) ======
const CONTACT_URL = "https://t.me/Fedka_e60";   // <-- сюда свой @username
const CONTACT_TEXT = "Fedka_e60";              // <-- как показывать в приложении
// Можно и так: "mailto:you@mail.com" или "https://t.me/username"
// ===============================================

const API_BASE = "https://you-tube-app.onrender.com";
const SETTINGS_KEY = "minitube_settings_v1";

const defaultSettings = {
  region: "RU",
  maxResults: 12,
  layout: "list",       // list | grid
  autoplay: true,
  accent: "auto",       // auto | purple | blue | green | red
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    const s = JSON.parse(raw);
    return { ...defaultSettings, ...s };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

let settings = loadSettings();

// ====== навигация ======
const tabs = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");

function goTo(pageName) {
  tabs.forEach(b => b.classList.toggle("active", b.dataset.to === pageName));
  pages.forEach(p => p.classList.toggle("active", p.dataset.page === pageName));
}
tabs.forEach(btn => btn.addEventListener("click", () => goTo(btn.dataset.to)));

// ====== элементы ======
const qEl = document.getElementById("searchInput");
const list = document.getElementById("list");
const statusEl = document.getElementById("status");
const playerWrap = document.getElementById("playerWrap");
const player = document.getElementById("player");

const setRegion = document.getElementById("setRegion");
const setMaxResults = document.getElementById("setMaxResults");
const setLayout = document.getElementById("setLayout");
const setAutoplay = document.getElementById("setAutoplay");
const setAccent = document.getElementById("setAccent");
const setReset = document.getElementById("setReset");

const contactLink = document.getElementById("contactLink");

// ====== контакты ======
contactLink.textContent = CONTACT_TEXT;
contactLink.addEventListener("click", (e) => {
  e.preventDefault();
  if (tg?.openTelegramLink) tg.openTelegramLink(CONTACT_URL);
  else window.open(CONTACT_URL, "_blank");
});

// ====== helpers ======
function setStatus(t) { if (statusEl) statusEl.textContent = t || ""; }

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

async function apiJson(url) {
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// ====== apply settings (layout + accent) ======
function applyAccent() {
  const root = document.documentElement;
  if (settings.accent === "auto") {
    root.style.removeProperty("--accent");
    return;
  }
  const map = {
    purple: "#7c5cff",
    blue: "#3b82f6",
    green: "#22c55e",
    red: "#ef4444",
  };
  root.style.setProperty("--accent", map[settings.accent] || "#7c5cff");
}

function applyLayout() {
  if (settings.layout === "grid") list.classList.add("grid2");
  else list.classList.remove("grid2");
}

function applySettings() {
  applyAccent();
  applyLayout();
}

// ====== player ======
function closePlayer() {
  player.src = "";
  playerWrap.style.display = "none";
  if (tg?.BackButton) tg.BackButton.hide();
}

const backHandler = () => closePlayer();

function openVideo(videoId) {
  playerWrap.style.display = "block";
  const ap = settings.autoplay ? 1 : 0;
  player.src = `https://www.youtube.com/embed/${videoId}?autoplay=${ap}&playsinline=1`;

  if (tg?.BackButton) {
    tg.BackButton.show();
    tg.BackButton.offClick?.(backHandler);
    tg.BackButton.onClick(backHandler);
  }
}

// ====== render ======
function render(items) {
  list.innerHTML = "";

  items.forEach(it => {
    const div = document.createElement("div");
    const isGrid = (settings.layout === "grid");

    div.className = isGrid ? "card cardGrid" : "card";
    const imgClass = isGrid ? "thumb thumbGrid" : "thumb";

    div.innerHTML = `
      <img class="${imgClass}" src="${esc(it.thumbnail)}" />
      <div class="cardBody">
        <div class="title">${esc(it.title)}</div>
        <div class="muted">${esc(it.channelTitle)}</div>
      </div>
    `;

    div.onclick = () => openVideo(it.videoId);
    list.appendChild(div);
  });
}

// ====== data loading ======
async function loadPopular() {
  goTo("home");
  closePlayer();
  setStatus("Загружаю популярное…");

  try {
    const url = `${API_BASE}/popular?region=${encodeURIComponent(settings.region)}&max_results=${settings.maxResults}`;
    const data = await apiJson(url);
    render(data.items || []);
    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus("Ошибка популярного: " + (e?.message || "unknown"));
  }
}

async function doSearch(q) {
  goTo("home");
  closePlayer();
  setStatus("Ищу…");

  try {
    const url = `${API_BASE}/search?q=${encodeURIComponent(q)}&max_results=${settings.maxResults}`;
    const data = await apiJson(url);
    render(data.items || []);
    setStatus((data.items && data.items.length) ? "" : "Ничего не найдено");
  } catch (e) {
    console.error(e);
    setStatus("Ошибка поиска: " + (e?.message || "unknown"));
  }
}

// ====== search events ======
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

// ====== settings UI init + handlers ======
function syncSettingsUI() {
  setRegion.value = settings.region;
  setMaxResults.value = settings.maxResults;
  setLayout.value = settings.layout;
  setAutoplay.checked = !!settings.autoplay;
  setAccent.value = settings.accent;
}

function updateSettings(patch) {
  settings = { ...settings, ...patch };

  // защита от кривых значений
  settings.maxResults = Math.max(5, Math.min(25, Number(settings.maxResults) || 12));

  saveSettings(settings);
  applySettings();
}

setRegion?.addEventListener("change", () => {
  updateSettings({ region: setRegion.value });
  loadPopular();
});

setMaxResults?.addEventListener("change", () => {
  updateSettings({ maxResults: Number(setMaxResults.value) });
  loadPopular();
});

setLayout?.addEventListener("change", () => {
  updateSettings({ layout: setLayout.value });
  // если сейчас пустой поиск — обновим популярное, чтобы сразу выглядело по-новому
  const q = qEl.value.trim();
  if (!q) loadPopular();
});

setAutoplay?.addEventListener("change", () => {
  updateSettings({ autoplay: setAutoplay.checked });
});

setAccent?.addEventListener("change", () => {
  updateSettings({ accent: setAccent.value });
});

setReset?.addEventListener("click", () => {
  updateSettings({ ...defaultSettings });
  syncSettingsUI();
  loadPopular();
});

// старт
applySettings();
syncSettingsUI();
loadPopular();