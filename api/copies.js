const FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";

function cleanEnvValue(value) {
  return String(value || "").trim();
}

function getBitableConfig() {
  const appToken = cleanEnvValue(process.env.FEISHU_BITABLE_APP_TOKEN).split(/[?&]/)[0];
  const tableId = cleanEnvValue(process.env.FEISHU_BITABLE_TABLE_ID).split(/[?&]/)[0];

  if (appToken.startsWith("tbl")) {
    throw new Error("FEISHU_BITABLE_APP_TOKEN looks like a table id. Use the token after /base/ in the Feishu URL.");
  }
  if (tableId.startsWith("vew")) {
    throw new Error("FEISHU_BITABLE_TABLE_ID looks like a view id. Use the value after table= in the Feishu URL.");
  }

  return { appToken, tableId };
}

function json(response, status = 200) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
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

function getDateField(fields, name) {
  const value = fields[name];
  if (!value) return new Date().toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function getTenantAccessToken() {
  const response = await fetch(FEISHU_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || "Failed to get Feishu tenant access token");
  }
  return data.tenant_access_token;
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
      throw new Error(data.msg || "Failed to list Feishu records");
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

  return {
    id: record.record_id,
    category: getTextField(fields, "分类") || "未分类",
    theme: getTextField(fields, "主题") || "未命名主题",
    videoUrl: getTextField(fields, "视频链接"),
    body: getTextField(fields, "文案"),
    tags,
    createdAt: getDateField(fields, "更新时间"),
    updatedAt: getDateField(fields, "更新时间"),
    visible: getCheckboxField(fields, "是否显示"),
  };
}

export default async function handler(request, response) {
  response.setHeader("access-control-allow-origin", process.env.ALLOWED_ORIGIN || "*");
  response.setHeader("access-control-allow-methods", "GET, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    json(response, 405);
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const required = [
    "FEISHU_APP_ID",
    "FEISHU_APP_SECRET",
    "FEISHU_BITABLE_APP_TOKEN",
    "FEISHU_BITABLE_TABLE_ID",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    json(response, 500);
    response.end(JSON.stringify({ error: `Missing env vars: ${missing.join(", ")}` }));
    return;
  }

  try {
    const token = await getTenantAccessToken();
    const records = await listRecords(token);
    const entries = records.map(toCopyEntry).filter((entry) => entry.visible && entry.body);
    json(response);
    response.setHeader("cache-control", "s-maxage=60, stale-while-revalidate=300");
    response.end(JSON.stringify(entries));
  } catch (error) {
    json(response, 500);
    response.end(JSON.stringify({ error: error.message }));
  }
}
