# RH Studio

RunningHub API workflow console.

## Features

- RunningHub AI App execution
- Dynamic node parameter mapping
- Media upload and proxy routes through Cloudflare Pages Functions
- Automatic task polling every 3 seconds
- Image / video / audio / text result preview
- API Key stored only in browser localStorage
- Titanium gray × warm white × amber glass UI

## Deployment

This repository is the canonical source for RH Studio.

Production is deployed on Cloudflare Pages from the `main` branch.

- Build command: `npm run build`
- Build output directory: `dist`
- Pages Functions: the project-root `functions/` directory
- Shared RunningHub request handlers: `api/rh/`

The build copies the frontend assets into `dist`. Pages Functions provide the RunningHub API routes, streaming upload, media proxies, and `/healthz`; Pages serves `/history` using its built-in extensionless HTML routing.

For local development, run `npm start` to use `server.js`.

No RunningHub API Key is committed to the repository.
