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

function toFeishuRecord(entry) {
  return {
    fields: {
      主题: entry.theme || "未命名主题",
      分类: entry.category || "未分类",
      视频链接: entry.videoUrl || "",
      文案: entry.body || "",
      标签: Array.isArray(entry.tags) ? entry.tags.join("，") : String(entry.tags || ""),
      是否显示: true,
      更新时间: Date.now(),
    },
  };
}

async function batchCreateRecords(token, records) {
  const { appToken, tableId } = getBitableConfig();
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ records }),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || "Failed to import records");
  }
  return data.data?.records || [];
}

const entries = JSON.parse(await fs.readFile(new URL("../data/copies.json", import.meta.url), "utf8"));
const records = entries.map(toFeishuRecord);

if (!records.length) {
  console.log("No records to import.");
  process.exit(0);
}

const token = await getTenantAccessToken();
let imported = 0;

for (let index = 0; index < records.length; index += 100) {
  const batch = records.slice(index, index + 100);
  const created = await batchCreateRecords(token, batch);
  imported += created.length || batch.length;
}

console.log(`Imported ${imported} records to Feishu.`);
