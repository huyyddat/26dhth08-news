/* =====================================================================
   CẤU HÌNH — CHỈNH SỬA PHẦN NÀY CHO ĐÚNG VỚI REPO CỦA BẠN
   ===================================================================== */
const CONFIG = {
  githubUsername: "YOUR_GITHUB_USERNAME",   // ví dụ: "nguyenvana"
  repoName: "YOUR_REPO_NAME",               // ví dụ: "sinhvien-portal"
  branch: "main",                           // tên nhánh chứa nội dung, ví dụ: "main"

  // Danh sách chuyên mục: key = định danh nội bộ, label = tên hiển thị,
  // path = đường dẫn thư mục chứa file .md trong repo (không có dấu / ở đầu/cuối)
  categories: [
    { key: "hoc-bong",    label: "Học bổng",   path: "content/hoc-bong" },
    { key: "su-kien",     label: "Sự kiện",    path: "content/su-kien" },
    { key: "tuyen-dung",  label: "Tuyển dụng", path: "content/tuyen-dung" },
    { key: "thong-bao",   label: "Thông báo",  path: "content/thong-bao" }
  ]
};
/* ===================================================================== */

(function () {
  "use strict";

  const navEl = document.getElementById("category-nav");
  const listView = document.getElementById("list-view");
  const detailView = document.getElementById("detail-view");
  const articleListEl = document.getElementById("article-list");
  const statusEl = document.getElementById("status-msg");
  const articleDetailEl = document.getElementById("article-detail");
  const backBtn = document.getElementById("back-btn");
  const searchInput = document.getElementById("search-input");

  // Bộ nhớ đệm trong phiên làm việc: { categoryKey: [ {title, date, summary, image, body, error?} ] }
  const cache = {};
  let activeCategory = null;
  let activeArticles = []; // danh sách bài viết đang hiển thị (đã sort), dùng để lọc tìm kiếm

  function apiContentsUrl(path) {
    return `https://api.github.com/repos/${CONFIG.githubUsername}/${CONFIG.repoName}/contents/${path}?ref=${CONFIG.branch}`;
  }

  /* ---------- Parse frontmatter đơn giản (key: value) ---------- */
  function parseFrontmatter(raw, fallbackTitle) {
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    const meta = { title: fallbackTitle, date: "", summary: "", category: "", image: "" };

    if (!match) {
      // Không có frontmatter hợp lệ -> vẫn hiển thị được, dùng toàn bộ nội dung làm body
      return { meta, body: raw };
    }

    const [, front, body] = match;
    front.split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return;
      const key = line.slice(0, idx).trim().toLowerCase();
      let value = line.slice(idx + 1).trim();
      value = value.replace(/^["']|["']$/g, ""); // bỏ dấu ngoặc kép/đơn bao quanh
      if (key in meta) meta[key] = value;
    });

    if (!meta.title) meta.title = fallbackTitle;
    return { meta, body: body || "" };
  }

  function stripMarkdown(text) {
    return text.replace(/[#*_`>\-\[\]!]/g, "").replace(/\s+/g, " ").trim();
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  /* ---------- Tải danh sách file .md của một chuyên mục ---------- */
  async function fetchCategoryFiles(category) {
    let listing;
    try {
      const res = await fetch(apiContentsUrl(category.path));
      if (res.status === 404) return []; // thư mục chưa tồn tại / trống
      if (!res.ok) throw new Error("HTTP " + res.status);
      listing = await res.json();
    } catch (err) {
      console.warn(`Không thể tải danh sách chuyên mục "${category.label}":`, err);
      return null; // null = lỗi tải, khác với [] = trống
    }

    if (!Array.isArray(listing)) return [];
    const mdFiles = listing.filter((item) => item.type === "file" && item.name.toLowerCase().endsWith(".md"));

    const articles = await Promise.all(
      mdFiles.map(async (file) => {
        try {
          const res = await fetch(file.download_url);
          if (!res.ok) throw new Error("HTTP " + res.status);
          const raw = await res.text();
          const fallbackTitle = file.name.replace(/\.md$/i, "");
          const { meta, body } = parseFrontmatter(raw, fallbackTitle);
          return {
            title: meta.title,
            date: meta.date,
            summary: meta.summary || stripMarkdown(body).slice(0, 140),
            image: meta.image || "",
            body: body
          };
        } catch (err) {
          console.warn(`Bỏ qua file lỗi "${file.name}":`, err);
          return null; // file lỗi -> bỏ qua, không làm crash trang
        }
      })
    );

    return articles.filter(Boolean).sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (isNaN(da) && isNaN(db)) return 0;
      if (isNaN(da)) return 1;
      if (isNaN(db)) return -1;
      return db - da; // mới nhất trước
    });
  }

  /* ---------- Render menu chuyên mục ---------- */
  function renderNav() {
    navEl.innerHTML = "";
    CONFIG.categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-btn";
      btn.textContent = cat.label;
      btn.dataset.key = cat.key;
      btn.addEventListener("click", () => selectCategory(cat.key));
      navEl.appendChild(btn);
    });
  }

  function updateActiveNavButton() {
    Array.prototype.forEach.call(navEl.children, (btn) => {
      btn.classList.toggle("active", btn.dataset.key === activeCategory);
    });
  }

  /* ---------- Render danh sách bài viết ---------- */
  function renderArticleList(articles) {
    articleListEl.innerHTML = "";

    if (articles.length === 0) {
      statusEl.hidden = false;
      statusEl.textContent = "Chưa có nội dung.";
      return;
    }
    statusEl.hidden = true;

    articles.forEach((article) => {
      const card = document.createElement("div");
      card.className = "article-card";
      card.innerHTML = `
        ${article.image ? `<img src="${escapeAttr(article.image)}" alt="">` : ""}
        <div class="article-card-body">
          ${article.date ? `<div class="article-card-date">${formatDate(article.date)}</div>` : ""}
          <div class="article-card-title">${escapeHtml(article.title)}</div>
          <div class="article-card-summary">${escapeHtml(article.summary)}</div>
        </div>
      `;
      card.addEventListener("click", () => showDetail(article));
      articleListEl.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return (str || "").replace(/"/g, "&quot;");
  }

  /* ---------- Chuyển chuyên mục ---------- */
  async function selectCategory(key) {
    activeCategory = key;
    updateActiveNavButton();
    showListView();
    searchInput.value = "";

    if (cache[key]) {
      activeArticles = cache[key];
      renderArticleList(activeArticles);
      return;
    }

    statusEl.hidden = false;
    statusEl.textContent = "Đang tải...";
    articleListEl.innerHTML = "";

    const category = CONFIG.categories.find((c) => c.key === key);
    const articles = await fetchCategoryFiles(category);

    if (articles === null) {
      statusEl.hidden = false;
      statusEl.textContent = "Không thể tải nội dung lúc này (có thể do giới hạn truy cập của GitHub). Vui lòng thử lại sau.";
      activeArticles = [];
      return;
    }

    cache[key] = articles;
    activeArticles = articles;
    renderArticleList(activeArticles);
  }

  /* ---------- Xem chi tiết bài viết ---------- */
  function showDetail(article) {
    const html = window.marked ? marked.parse(article.body || "") : escapeHtml(article.body || "");
    articleDetailEl.innerHTML = `
      ${article.image ? `<img class="hero" src="${escapeAttr(article.image)}" alt="">` : ""}
      <h1>${escapeHtml(article.title)}</h1>
      <div class="meta">${article.date ? formatDate(article.date) : ""}</div>
      <div class="article-body">${html}</div>
    `;
    listView.hidden = true;
    detailView.hidden = false;
    window.scrollTo(0, 0);
  }

  function showListView() {
    detailView.hidden = true;
    listView.hidden = false;
  }

  backBtn.addEventListener("click", showListView);

  /* ---------- Tìm kiếm theo tiêu đề ---------- */
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q
      ? activeArticles.filter((a) => a.title.toLowerCase().includes(q))
      : activeArticles;
    renderArticleList(filtered);
  });

  /* ---------- Khởi động ---------- */
  function init() {
    renderNav();
    if (CONFIG.categories.length > 0) {
      selectCategory(CONFIG.categories[0].key);
    } else {
      statusEl.hidden = false;
      statusEl.textContent = "Chưa cấu hình chuyên mục nào.";
    }
  }

  init();
})();
