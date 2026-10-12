# oTATo Tools

统一管理 oTATo 的小工具，访问入口：<https://tools.otato.art>。

## 目录

```text
apps/          各个小工具的源代码，按工具名称建立独立目录
public/        工具入口及公共静态资源
scripts/       统一构建脚本
dist/          自动生成的 Cloudflare Pages 发布目录
```

每个工具使用独立路径，例如 `https://tools.otato.art/relighting/`。
静态工具可放在 `public/<工具名称>/`；需要构建的工具，其源代码放在
`apps/<工具名称>/`，接入时在统一构建脚本中将产物输出到 `dist/<工具名称>/`。
需要服务端功能的工具，在接入时单独确定运行方式，不能仅复制静态页面。

## 部署

- 托管：Cloudflare Pages。
- 生产分支：`main`。
- 构建命令：`npm run build`。
- 发布目录：`dist`。
- 已连接 GitHub，推送到 `main` 自动部署。

本地构建：`npm ci && npm run build`。

## 现有工具

- [AI 重打光提示词生成器 / RELIGHT LAB](https://tools.otato.art/relighting/)
  — [源码](apps/relighting/)，保留原仓库完整的 `main` 提交历史。
  统一构建会从源码重新生成独立 HTML，内嵌 React、Three.js 和样式，不需要后端。
- [RH Studio](https://tools.otato.art/rh-studio/)
  — [源码](apps/rh-studio/)，RunningHub 工作台及上传、查询、媒体代理、ZIP 导出接口。
  生成记录位于 `/rh-studio/history`；相关 Pages Functions 位于 `functions/rh-studio/`。
  使用 `npm run dev:rh-studio` 启动本地服务。API Key、历史与素材属于浏览器本地数据，旧域名的数据不会自动跨域迁入。

## 开发约定

各工具的源代码、说明和依赖放在各自目录中。API 密钥和其他凭据不得提交到仓库。
项目技能入口见 `SKILLS_INDEX.md`。
