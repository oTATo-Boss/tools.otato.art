# RH Studio

RunningHub API workflow console.

## Current apps

Only three apps are active: Qwen 2.1 写实抓拍 (image), MiniMax-H3 V2 小白全能版 (video), and MiniMax-H3 无限长视频 (video). The eight retired apps and their dedicated workspaces/runtimes have been removed. Existing generation history and saved browser materials are preserved; removed-app links fall back to an active app without importing an old task into it.

## Features

- RunningHub AI App execution
- Dynamic node parameter mapping
- Media upload and proxy routes through Cloudflare Pages Functions
- Automatic task polling every 3 seconds
- Image / video / audio / text result preview
- API Key stored only in browser localStorage
- Titanium gray × warm white × amber glass UI

## Deployment

The canonical source for RH Studio is `apps/rh-studio/` in
[`oTATo-Boss/tools.otato.art`](https://github.com/oTATo-Boss/tools.otato.art).

Production is deployed on Cloudflare Pages from the `main` branch of that repository:
https://tools.otato.art/rh-studio/.

- Build command: `npm run build` at the repository root
- Build output directory: root `dist`, with this tool's assets in `dist/rh-studio/`
- Pages Functions: root `functions/rh-studio/`
- Shared RunningHub request handlers: `apps/rh-studio/api/rh/`

The root build includes this tool's frontend assets. Pages Functions provide
`/rh-studio/api/rh/*`, `/rh-studio/rh-upload`, `/rh-studio/rh-media/*`,
`/rh-studio/rh-media-hk/*`, and `/rh-studio/healthz`. Pages serves
`/rh-studio/history` using its built-in extensionless HTML routing.

For local development, run `npm start` from `apps/rh-studio/` to use `server.js`,
then open `http://localhost:3000/rh-studio/`. The local server also accepts the
original unprefixed paths. Set `PORT` to use a different port.

No RunningHub API Key is committed to the repository.

## Browser data

API Key, settings, task recovery, and generation history remain in browser
localStorage; saved material files remain in IndexedDB. Storage names are
unchanged, but browsers isolate this data by origin. Data saved on the previous
RH Studio domain remains there and is not automatically copied to
`tools.otato.art`. Enter the API Key again in the new site's settings and use
Task ID import to recover existing tasks as needed.


## 新接入应用：Minimax-H3 长视频小白全能版

- 应用键：minimax-h3-long，AI App ID：2103012816681041921。
- 页面组件在 index.html，逻辑和节点映射独立于 minimax-h3-long.js。
- 与现有应用共用 /rh-studio/api/rh/* 及 /rh-studio/rh-upload，无需添加独立 Pages Functions。
- 6 图输入独立保存于当前浏览器的 rhstudio-minimax-h3-long-materials IndexedDB；
  控制参数使用 rhstudio.minimaxH3Long.config localStorage。
- 新增单元测试：tests/rh-studio-minimax-h3-long.test.mjs。


## MiniMax-H3 V2 beginner app · Skill 4.0.1

- Skill snapshot: https://github.com/oTATo-Boss/my-skills/tree/main/skills/video/ai/rh-minimax-h3
- AI App ID: `2101232638873858050`; RH Studio app key: `minimax-h3-beginner-v2`.
- Uses `minimax-h3-v2-config.js` (25 nodes) and `minimax-h3-v2-runtime.js` (uploads, polling, results, browser persistence). Unlike the long-video app, this workflow generates 5–15-second clips.
- Inputs: 1–6 images, up to 2 audio files. Empty image nodes repeat the last supplied image; Node 827 records the true image count.
- Main generation controls: aspect ratio, resolution (480P/720P/1080P), duration (5–15s). A collapsible panel exposes **four independent LoRA strengths** (defaults 0.4 / 0.5 / 0.6 / 0.2, persisted locally); LoRA filenames, trigger, base model and workflow flags remain fixed to the Skill v4 snapshot. Running instance comes from global RH Studio Settings (1080P requires Ultra).
- Output URLs normally expire after 24 hours. Video generation and the new LoRA combination have not been live-verified.
- Tests: `tests/rh-studio-minimax-h3-v2.test.mjs`.


## Qwen 2.1 写实抓拍 · Snapshot Realism

- App key: `qwen-image-2-1-editorial`; RunningHub AI App ID: `2104057271167791105`.
- Supports text-only or up to six optional reference images (476/491/477/492/495/494), editable Prompt (497/prompt), eight aspect ratios (13/aspect_ratio), fixed 2MP (13/megapixels) and one output (527/value).
- Screenshot-selected base model (479/unet_name): `noctQUncensoredRealismBuiltOn_v40Base_bf16.safetensors`.
- LoRA 1 (510/lora_name): `casual_snapshot_realism_qwen21.safetensors`, strength `0.8`; LoRA 2 (526/lora_name): `cndamiph_Candid_Amateur_iPhone_Qwen21_v1.safetensors`, strength `0.5`.
- Other API fields stay fixed: nodes 528/515=true (prompt enhancement and acceleration), 521/525=false, node 554 original note, sampler 484 (er_sde, beta, 40 steps, cfg 3.5).
- Existing shared upload, run, query, history, preview, diagnostics, and downloads; isolated localStorage keys `rhstudio.qwenEditorial.*` and IndexedDB `rhstudio-qwen-editorial-materials`.
- Source: `qwen-editorial-config.js` / `qwen-editorial-runtime.js`. Tests: `tests/rh-studio-qwen-editorial.test.mjs`.

- Defaults synced to RH-Qwen Skill 3.0.1 on 2026-11-03. Plus is selected when this app opens without a saved global instance; an explicitly saved global choice always wins. Existing app key, media storage and history remain compatible. No new model-specific trigger is assumed; no paid generation was submitted during this configuration update.
