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
