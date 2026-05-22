# 发布到 GitHub Pages

## 方式一：你提供仓库地址后由 Codex 推送

新建一个空的 GitHub 仓库，例如：

```text
https://github.com/你的用户名/copy-library.git
```

然后把仓库地址发给 Codex。Codex 会执行：

```bash
git remote add origin https://github.com/你的用户名/copy-library.git
git push -u origin main
```

推送完成后，在 GitHub 仓库里打开：

```text
Settings → Pages → Build and deployment → Source: Deploy from a branch
Branch: main / root
```

网址通常是：

```text
https://你的用户名.github.io/copy-library/
```

## 方式二：手动上传

1. 在 GitHub 新建一个 public 仓库
2. 上传本目录的全部文件
3. 到 `Settings → Pages`
4. 选择 `Deploy from a branch`
5. 选择 `main` 分支和 `/root`

几分钟后即可访问 GitHub Pages 网址。
