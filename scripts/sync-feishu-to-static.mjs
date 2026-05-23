import fs from "node:fs/promises";

const FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getBitableConfig() {
  const appToken = requiredEnv("FEISHU_BITABLE_APP_TOKEN").split(/[?&]/)[0];
  const tableId = requiredEnv("FEISHU_BITABLE_TABLE_ID").split(/[?&]/)[0];

  if (appToken.startsWith("tbl")) {
    throw new Error("FEISHU_BITABLE_APP_TOKEN looks like a table id. Use the token after /base/ in the Feishu URL.");
  }
  if (tableId.startsWith("vew")) {
    throw new Error("FEISHU_BITABLE_TABLE_ID looks like a view id. Use the value after table= in the Feishu URL.");
  }

  return { appToken, tableId };
}

async function getTenantAccessToken() {
  const response = await fetch(FEISHU_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: requiredEnv("FEISHU_APP_ID"),
      app_secret: requiredEnv("FEISHU_APP_SECRET"),
    }),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || "Failed to get Feishu tenant access token");
  }
  return data.tenant_access_token;
}

function getTextField(fields, name) {
  const value = fields[name];
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.text || item?.name || item?.url || "";
      })
      .filter(Boolean)
      .join("");
  }
  return value.text || value.name || value.url || "";
}

function getCheckboxField(fields, name) {
  const value = fields[name];
  if (value == null) return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return !["false", "0", "否", "隐藏"].includes(value.trim());
  return Boolean(value);
}

function getOptionalCheckboxField(fields, name) {
  if (!(name in fields) || fields[name] == null) return false;
  return getCheckboxField(fields, name);
}

function getDateField(fields, name) {
  const value = fields[name];
  if (value == null || value === "") return "";
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }
  if (Array.isArray(value) && value[0]) return getDateField({ value: value[0] }, "value");
  const candidate = value.timestamp || value.value || value.text;
  return candidate ? getDateField({ value: candidate }, "value") : "";
}

async function listRecords(token) {
  const { appToken, tableId } = getBitableConfig();
  const records = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (pageToken) params.set("page_token", pageToken);
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?${params}`;
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok || data.code !== 0) {
      throw new Error(`${data.msg || "Failed to list Feishu records"} (${data.code || response.status})`);
    }
    records.push(...(data.data?.items || []));
    pageToken = data.data?.page_token || "";
  } while (pageToken);

  return records;
}

function toCopyEntry(record) {
  const fields = record.fields || {};
  const tags = getTextField(fields, "标签")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const body = getTextField(fields, "文案") || getTextField(fields, "备注");
  const theme =
    getTextField(fields, "主题") ||
    getTextField(fields, "素材名称") ||
    body.split(/\n/)[0].slice(0, 10) ||
    "未命名主题";
  const publishedAt =
    getDateField(fields, "发布时间") ||
    getDateField(fields, "更新时间") ||
    getDateField(fields, "创建时间") ||
    new Date().toISOString();

  return {
    id: record.record_id,
    category: getTextField(fields, "分类") || "未分类",
    theme,
    videoUrl: getTextField(fields, "视频链接") || getTextField(fields, "素材链接"),
    body,
    tags,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    visible: getCheckboxField(fields, "是否显示"),
  };
}

function isPlaceholder(entry) {
  const theme = entry.theme.trim();
  const body = entry.body.trim();
  return (
    !theme ||
    !body ||
    theme === "输入素材名称" ||
    body === "输入备注内容" ||
    entry.videoUrl.trim() === "设置列类型为超链接,插入素材链接"
  );
}

const token = await getTenantAccessToken();
const entries = (await listRecords(token))
  .map(toCopyEntry)
  .filter((entry) => entry.visible && !isPlaceholder(entry))
  .map(({ visible, ...entry }) => entry);

await fs.writeFile(new URL("../data/copies.json", import.meta.url), `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Synced ${entries.length} records from Feishu to data/copies.json.`);
