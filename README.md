# 文案库网站

一个可部署到 GitHub Pages 的文案库，也支持通过 Vercel 云函数读取飞书多维表格。

## 功能

- 目录分类
- 搜索筛选
- 文案详情页
- 永久链接
- 一键复制标题、文案、全文
- 粘贴完整文本后自动拆解
- 浏览器内新增、编辑分类和文案
- JSON 导入 / 导出
- 飞书多维表格读取

## 飞书表格维护版

飞书多维表格字段：

```text
主题
分类
视频链接
文案
标签
是否显示
更新时间
```

部署 Vercel 云函数时需要配置环境变量：

```text
FEISHU_APP_ID
FEISHU_APP_SECRET
FEISHU_BITABLE_APP_TOKEN
FEISHU_BITABLE_TABLE_ID
ALLOWED_ORIGIN
```

飞书链接示例：

```text
https://xxx.feishu.cn/base/bascnAbCdEfGhIjKl?table=tblA1B2C3D4&view=vewxxxx
```

对应关系：

```text
FEISHU_BITABLE_APP_TOKEN=bascnAbCdEfGhIjKl
FEISHU_BITABLE_TABLE_ID=tblA1B2C3D4
```

`vew...` 是视图 ID，不是数据表 ID。

拿到 Vercel 接口地址后，填写到 `config.js`：

```js
window.COPY_LIBRARY_API_URL = "https://你的-vercel-项目.vercel.app/api/copies";
```

把当前 `data/copies.json` 导入飞书：

```bash
npm run import:feishu
```

不使用 Vercel 时，可用 GitHub Actions 定时同步飞书到静态 JSON。需要在仓库
`Settings -> Secrets and variables -> Actions` 添加：

```text
FEISHU_APP_ID
FEISHU_APP_SECRET
FEISHU_BITABLE_APP_TOKEN
FEISHU_BITABLE_TABLE_ID
```

然后到 `Actions -> Sync Feishu Data -> Run workflow` 手动同步一次；之后会每小时自动同步。

## 本地 JSON 更新内容

页面内新增的内容会保存到当前浏览器。需要让线上网站长期展示这些内容时：

1. 点击页面左侧「导出 JSON」
2. 用导出的文件替换 `data/copies.json`
3. 提交到 GitHub，GitHub Pages 会自动更新

编辑和删除按钮默认隐藏。站点维护者可在自己的浏览器访问 `?admin=1` 开启管理模式，例如：

```text
https://grace-ppy.github.io/wenanku/?admin=1
```

支持的拆解格式：

```text
主题：
分类：
视频链接：
文案：
标签：
```
