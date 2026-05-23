const DATA_URL = "./data/copies.json";
const STORAGE_KEY = "copy-library-v1";
const ADMIN_KEY = "copy-library-admin";
const API_URL = window.COPY_LIBRARY_API_URL || "";

const state = {
  entries: [],
  activeCategory: "全部",
  search: "",
  detailId: null,
  adminMode: false,
  editingId: null,
};

const els = {
  categoryList: document.querySelector("#categoryList"),
  categoryOptions: document.querySelector("#categoryOptions"),
  entryList: document.querySelector("#entryList"),
  entryDetail: document.querySelector("#entryDetail"),
  entryPanel: document.querySelector("#entryPanel"),
  viewTitle: document.querySelector("#viewTitle"),
  totalCount: document.querySelector("#totalCount"),
  categoryCount: document.querySelector("#categoryCount"),
  tagCount: document.querySelector("#tagCount"),
  searchInput: document.querySelector("#searchInput"),
  toast: document.querySelector("#toast"),
  form: document.querySelector("#entryForm"),
  panelTitle: document.querySelector("#panelTitle"),
  submitButton: document.querySelector("#submitButton"),
  rawTextInput: document.querySelector("#rawTextInput"),
  themeInput: document.querySelector("#themeInput"),
  categoryInput: document.querySelector("#categoryInput"),
  videoUrlInput: document.querySelector("#videoUrlInput"),
  bodyInput: document.querySelector("#bodyInput"),
  tagsInput: document.querySelector("#tagsInput"),
};

function normalizeEntry(entry) {
  return {
    id: entry.id || createId(entry.theme),
    category: entry.category || "未分类",
    theme: entry.theme || "未命名主题",
    videoUrl: entry.videoUrl || "",
    body: entry.body || "",
    tags: Array.isArray(entry.tags)
      ? entry.tags
      : String(entry.tags || "")
          .split(/[，,]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
}

async function loadEntries() {
  if (API_URL) {
    try {
      const response = await fetch(API_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Remote API failed: ${response.status}`);
      const data = await response.json();
      state.entries = data.map(normalizeEntry);
      return;
    } catch (error) {
      console.warn(error);
      showToast("飞书数据读取失败，已显示本地数据");
    }
  }

  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    state.entries = JSON.parse(local).map(normalizeEntry);
    return;
  }

  const response = await fetch(DATA_URL);
  const data = await response.json();
  state.entries = data.map(normalizeEntry);
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries, null, 2));
}

function createId(seed = "copy") {
  const slug = seed
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `${stamp}-${slug || "copy"}`;
}

function getCategories() {
  const counts = new Map();
  state.entries.forEach((entry) => {
    counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"));
}

function getAllTags() {
  return new Set(state.entries.flatMap((entry) => entry.tags));
}

function render() {
  renderStats();
  renderCategories();
  renderCategoryOptions();
  renderDetail();
  renderList();
}

function renderStats() {
  els.totalCount.textContent = state.entries.length;
  els.categoryCount.textContent = getCategories().length;
  els.tagCount.textContent = getAllTags().size;
}

function renderCategories() {
  const categories = [["全部", state.entries.length], ...getCategories()];
  els.categoryList.innerHTML = categories
    .map(([name, count]) => {
      const active = state.activeCategory === name ? " active" : "";
      return `<button class="category-button${active}" data-category="${escapeAttr(name)}" type="button">
        <span>${escapeHtml(name)}</span>
        <span class="count">${count}</span>
      </button>`;
    })
    .join("");
}

function renderCategoryOptions() {
  els.categoryOptions.innerHTML = getCategories()
    .map(([name]) => `<option value="${escapeAttr(name)}"></option>`)
    .join("");
}

function filteredEntries() {
  const keyword = state.search.trim().toLowerCase();
  return state.entries
    .filter((entry) => state.activeCategory === "全部" || entry.category === state.activeCategory)
    .filter((entry) => {
      if (!keyword) return true;
      const haystack = [
        entry.theme,
        entry.category,
        entry.body,
        entry.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function renderList() {
  const entries = filteredEntries();
  els.viewTitle.textContent =
    state.activeCategory === "全部" ? "全部文案" : `${state.activeCategory} · ${entries.length} 条`;

  if (!entries.length) {
    els.entryList.innerHTML = `<div class="empty-state">还没有匹配的文案。可以新增一条，或换个搜索词。</div>`;
    return;
  }

  els.entryList.innerHTML = entries.map(renderCard).join("");
}

function renderCard(entry) {
  return `<article class="entry-card" id="card-${escapeAttr(entry.id)}">
    <div class="card-top">
      <div>
        <h3>${escapeHtml(entry.theme)}</h3>
        <div class="meta">
          <span class="category-chip">${escapeHtml(entry.category)}</span>
          <span>${formatDate(entry.updatedAt)}</span>
          ${renderVideoLink(entry.videoUrl, "视频链接")}
        </div>
      </div>
      <div class="card-actions">
        <button class="copy-button" data-copy-id="${escapeAttr(entry.id)}" data-copy-type="title" type="button">复制标题</button>
        <button class="copy-button" data-copy-id="${escapeAttr(entry.id)}" data-copy-type="body" type="button">复制文案</button>
        <button class="copy-button" data-copy-id="${escapeAttr(entry.id)}" data-copy-type="full" type="button">复制全文</button>
        <button class="copy-button" data-open-id="${escapeAttr(entry.id)}" type="button">永久链接</button>
        ${state.adminMode ? `<button class="copy-button" data-edit-id="${escapeAttr(entry.id)}" type="button">编辑</button><button class="copy-button danger-button" data-delete-id="${escapeAttr(entry.id)}" type="button">删除</button>` : ""}
      </div>
    </div>
    <p class="body-preview">${escapeHtml(entry.body)}</p>
    ${renderTags(entry.tags)}
  </article>`;
}

function renderDetail() {
  const id = state.detailId || getHashId();
  const entry = state.entries.find((item) => item.id === id);
  state.detailId = entry ? id : null;

  if (!entry) {
    els.entryDetail.hidden = true;
    els.entryDetail.innerHTML = "";
    return;
  }

  els.entryDetail.hidden = false;
  els.entryDetail.innerHTML = `<div class="detail-top">
    <div>
      <p class="eyebrow">Permanent Link</p>
      <h3>${escapeHtml(entry.theme)}</h3>
      <div class="meta">
        <span class="category-chip">${escapeHtml(entry.category)}</span>
        <span>${formatDate(entry.updatedAt)}</span>
      </div>
    </div>
    <div class="detail-actions">
      <button class="copy-button" data-copy-id="${escapeAttr(entry.id)}" data-copy-type="title" type="button">复制标题</button>
      <button class="copy-button" data-copy-id="${escapeAttr(entry.id)}" data-copy-type="body" type="button">复制文案</button>
      <button class="copy-button" data-copy-id="${escapeAttr(entry.id)}" data-copy-type="full" type="button">复制全文</button>
      ${state.adminMode ? `<button class="copy-button" data-edit-id="${escapeAttr(entry.id)}" type="button">编辑</button><button class="copy-button danger-button" data-delete-id="${escapeAttr(entry.id)}" type="button">删除</button>` : ""}
    </div>
  </div>
  ${renderVideoDetail(entry.videoUrl)}
  <div class="detail-section"><h4>文案</h4><p class="copy-block">${escapeHtml(entry.body)}</p></div>
  ${renderTags(entry.tags)}`;
}

function renderVideoLink(value, label) {
  const url = extractUrl(value);
  if (!value) return "";
  if (!url) return `<span>${escapeHtml(label)}</span>`;
  return `<a class="detail-link" href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function renderVideoDetail(value) {
  if (!value) return "";
  const url = extractUrl(value);
  const content = url
    ? `<a class="detail-link" href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>`
    : `<p class="copy-block">${escapeHtml(value)}</p>`;
  return `<div class="detail-section"><h4>视频链接</h4>${content}</div>`;
}

function extractUrl(value) {
  return String(value || "").match(/https?:\/\/[^\s，。；、]+/)?.[0] || "";
}

function renderTags(tags) {
  if (!tags.length) return "";
  return `<div class="tag-row">${tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function parseRawText(raw) {
  const labels = [
    ["theme", ["主题", "标题"]],
    ["category", ["分类", "目录"]],
    ["videoUrl", ["视频链接", "链接", "原视频"]],
    ["body", ["文案", "正文", "内容"]],
    ["tags", ["标签", "关键词"]],
  ];
  const ignoredLabels = new Set(["开头", "爆款开头", "结尾钩子", "结尾", "钩子"]);

  const result = {};
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let currentKey = null;
  const buffers = {};

  lines.forEach((line) => {
    const match = line.match(/^([^：:]{1,12})[：:]\s*(.*)$/);
    if (match && ignoredLabels.has(match[1].trim())) {
      currentKey = null;
      return;
    }
    const matched = match && labels.find(([, names]) => names.includes(match[1].trim()));
    if (matched) {
      currentKey = matched[0];
      buffers[currentKey] = [match[2] || ""];
      return;
    }
    if (currentKey) {
      buffers[currentKey].push(line);
    }
  });

  Object.entries(buffers).forEach(([key, value]) => {
    result[key] = value.join("\n").trim();
  });

  if (!Object.keys(result).length && raw.trim()) {
    result.body = raw.trim();
    result.theme = raw.trim().split("\n")[0].slice(0, 28);
  }

  return result;
}

function fillForm(parsed) {
  els.themeInput.value = parsed.theme || els.themeInput.value;
  els.categoryInput.value = parsed.category || els.categoryInput.value || "未分类";
  els.videoUrlInput.value = parsed.videoUrl || els.videoUrlInput.value;
  els.bodyInput.value = parsed.body || els.bodyInput.value;
  els.tagsInput.value = parsed.tags || els.tagsInput.value;
}

function entryToText(entry, type = "full") {
  if (type === "title") return entry.theme || "";
  if (type === "body") return entry.body || "";
  return [
    `主题：${entry.theme}`,
    entry.videoUrl ? `视频链接：${entry.videoUrl}` : "",
    `文案：${entry.body}`,
    entry.tags.length ? `标签：${entry.tags.join("，")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function copyEntry(id, type) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  await navigator.clipboard.writeText(entryToText(entry, type));
  showToast("已复制");
}

function openPermanentLink(id) {
  window.location.hash = `/copy/${id}`;
  state.detailId = id;
  render();
  document.querySelector("#entryDetail")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteEntry(id) {
  if (!state.adminMode) {
    showToast("当前不是管理模式");
    return;
  }

  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  const confirmed = window.confirm(`确定删除「${entry.theme}」吗？`);
  if (!confirmed) return;

  state.entries = state.entries.filter((item) => item.id !== id);
  if (state.detailId === id) {
    state.detailId = null;
    window.history.replaceState(null, "", window.location.pathname);
  }
  saveLocal();
  render();
  showToast("已删除");
}

function openCreatePanel() {
  state.editingId = null;
  els.panelTitle.textContent = "粘贴完整文本，自动拆解";
  els.submitButton.textContent = "保存文案";
  els.form.reset();
  els.rawTextInput.value = "";
  els.entryPanel.hidden = false;
  els.rawTextInput.focus();
}

function openEditPanel(id) {
  if (!state.adminMode) {
    showToast("当前不是管理模式");
    return;
  }

  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  state.editingId = id;
  els.panelTitle.textContent = "编辑文案";
  els.submitButton.textContent = "保存修改";
  els.rawTextInput.value = "";
  els.themeInput.value = entry.theme;
  els.categoryInput.value = entry.category;
  els.videoUrlInput.value = entry.videoUrl;
  els.bodyInput.value = entry.body;
  els.tagsInput.value = entry.tags.join("，");
  els.entryPanel.hidden = false;
  els.themeInput.focus();
  els.entryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEntryPanel() {
  state.editingId = null;
  els.panelTitle.textContent = "粘贴完整文本，自动拆解";
  els.submitButton.textContent = "保存文案";
  els.form.reset();
  els.rawTextInput.value = "";
  els.entryPanel.hidden = true;
}

function getHashId() {
  const match = window.location.hash.match(/#\/copy\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1600);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

document.querySelector("#newEntryButton").addEventListener("click", () => {
  openCreatePanel();
});

document.querySelector("#closePanelButton").addEventListener("click", () => {
  closeEntryPanel();
});

document.querySelector("#parseButton").addEventListener("click", () => {
  fillForm(parseRawText(els.rawTextInput.value));
  showToast("已拆解到右侧表单");
});

document.querySelector("#resetLocalButton").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
});

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderList();
});

els.categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.activeCategory = button.dataset.category;
  state.detailId = null;
  window.history.replaceState(null, "", window.location.pathname);
  render();
});

document.body.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-id]");
  if (copyButton) {
    copyEntry(copyButton.dataset.copyId, copyButton.dataset.copyType);
    return;
  }

  const openButton = event.target.closest("[data-open-id]");
  if (openButton) {
    openPermanentLink(openButton.dataset.openId);
    return;
  }

  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    openEditPanel(editButton.dataset.editId);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    deleteEntry(deleteButton.dataset.deleteId);
  }
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const wasEditing = Boolean(state.editingId);
  const draft = normalizeEntry({
    id: state.editingId || createId(els.themeInput.value),
    theme: els.themeInput.value.trim(),
    category: els.categoryInput.value.trim(),
    videoUrl: els.videoUrlInput.value.trim(),
    body: els.bodyInput.value.trim(),
    tags: els.tagsInput.value,
  });

  if (state.editingId) {
    const index = state.entries.findIndex((entry) => entry.id === state.editingId);
    if (index === -1) return;
    state.entries[index] = {
      ...state.entries[index],
      ...draft,
      id: state.entries[index].id,
      createdAt: state.entries[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
  } else {
    state.entries.unshift(draft);
  }

  saveLocal();
  const id = draft.id;
  closeEntryPanel();
  state.activeCategory = "全部";
  openPermanentLink(id);
  showToast(wasEditing ? "已保存修改" : "已保存到当前浏览器");
});

document.querySelector("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "copies.json";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  state.entries = imported.map(normalizeEntry);
  saveLocal();
  render();
  showToast("导入完成");
});

window.addEventListener("hashchange", () => {
  state.detailId = getHashId();
  render();
});

function initAdminMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("admin") === "1") {
    localStorage.setItem(ADMIN_KEY, "1");
    params.delete("admin");
    const query = params.toString();
    const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", cleanUrl);
  }
  state.adminMode = localStorage.getItem(ADMIN_KEY) === "1";
  document.body.classList.toggle("admin-mode", state.adminMode);
}

initAdminMode();

loadEntries()
  .then(() => {
    state.detailId = getHashId();
    render();
  })
  .catch((error) => {
    console.error(error);
    els.entryList.innerHTML = `<div class="empty-state">数据加载失败，请检查 data/copies.json。</div>`;
  });
