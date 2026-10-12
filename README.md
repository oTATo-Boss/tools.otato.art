# oTATo Tools

统一管理 oTATo 的小工具，访问入口：<https://tools.otato.art>。

## 目录

```text
apps/          各个小工具的源代码，按工具名称建立独立目录
public/        Cloudflare Pages 发布目录及工具入口
```

每个工具使用独立路径，例如 `https://tools.otato.art/relighting/`。
静态工具可放在 `public/<工具名称>/`；需要构建的工具，其源代码放在
`apps/<工具名称>/`，接入时将构建产物输出到对应发布目录，并更新 Pages 构建命令。
需要服务端功能的工具，在接入时单独确定运行方式，不能仅复制静态页面。

## 部署

- 托管：Cloudflare Pages。
- 生产分支：`main`。
- 初始构建命令：留空。
- 发布目录：`public`。
- 接入 GitHub 后，推送到 `main` 自动部署。

## 现有工具

目前尚未迁入工具。后续可以先接入
[AI Relighting Prompt Generator](https://github.com/oTATo-Boss/AI_Relighting_Prompt_Generator_Project)。

## 开发约定

各工具的源代码、说明和依赖放在各自目录中。API 密钥和其他凭据不得提交到仓库。
项目技能入口见 `SKILLS_INDEX.md`。
