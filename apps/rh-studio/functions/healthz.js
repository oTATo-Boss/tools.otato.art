export const onRequest = () =>
  Response.json({ ok: true, service: 'rh-studio', runtime: 'cloudflare', timestamp: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'no-store' }
  });
