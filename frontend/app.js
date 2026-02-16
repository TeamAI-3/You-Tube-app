// Telegram init (если открыто внутри Telegram)
if (window.Telegram?.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
}

const tabs = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");

tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    const to = btn.dataset.to;

    tabs.forEach(b => b.classList.toggle("active", b === btn));
    pages.forEach(p => p.classList.toggle("active", p.dataset.page === to));
  });
});

// Контакты (поменяй на свой @username)
document.getElementById("contactLink")?.addEventListener("click", (e) => {
  e.preventDefault();
  const url = "https://t.me/USERNAME"; // <-- поменяй
  if (Telegram?.WebApp?.openTelegramLink) Telegram.WebApp.openTelegramLink(url);
  else window.open(url, "_blank");
});

// Поиск (пока просто готовим точку входа)
document.getElementById("searchInput")?.addEventListener("input", (e) => {
  const q = e.target.value.trim();
  // сюда потом подключим твой поиск видео
  // console.log("search:", q);
});