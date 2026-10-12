import assert from 'node:assert/strict';
import test from 'node:test';

const request = path => new Request(`https://tools.otato.art/rh-studio/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
});

test('namespaced handlers preserve validation responses without sending an upstream request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected upstream request'); };
  try {
    for (const name of ['run', 'query', 'upload']) {
      const { onRequest } = await import(`../functions/rh-studio/api/rh/${name}.js`);
      const response = await onRequest({ request: request(`api/rh/${name}`) });
      assert.equal(response.status, 401);
      assert.match((await response.json()).error, /API Key/);
    }
    const { onRequest } = await import('../functions/rh-studio/api/rh/archive.js');
    const response = await onRequest({ request: request('api/rh/archive') });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, '没有可打包的文件');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('media proxies remove only the mount prefix and retain file paths, query and Range headers', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [route, hostname] of [
      ['rh-media', 'rh-images-1252422369.cos.ap-beijing.myqcloud.com'],
      ['rh-media-hk', 'rh-hk-images-1252422369.cos.ap-hongkong.myqcloud.com'],
    ]) {
      let upstream;
      let options;
      globalThis.fetch = async (url, init) => {
        upstream = new URL(url);
        options = init;
        return new Response('partial media', { status: 206 });
      };
      const { onRequest } = await import(`../functions/rh-studio/${route}/[[path]].js`);
      const response = await onRequest({ request: new Request(
        `https://tools.otato.art/rh-studio/${route}/results/nested/file.mp4?sign=test`,
        { headers: { Range: 'bytes=0-12' } },
      ) });
      assert.equal(upstream.hostname, hostname);
      assert.equal(upstream.pathname, '/results/nested/file.mp4');
      assert.equal(upstream.search, '?sign=test');
      assert.equal(options.headers.get('Range'), 'bytes=0-12');
      assert.equal(response.status, 206);
      assert.equal(await response.text(), 'partial media');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('binary upload passes the request stream through without buffering it', async () => {
  const { onRequest } = await import('../functions/rh-studio/rh-upload.js');
  const incoming = new Request('https://tools.otato.art/rh-studio/rh-upload', {
    method: 'POST', body: 'fixture upload', duplex: 'half',
    headers: { Authorization: 'Bearer migration-fixture' },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://www.runninghub.ai/openapi/v2/media/upload/binary');
    assert.equal(options.body, incoming.body);
    assert.equal(incoming.bodyUsed, false);
    assert.equal(options.headers.get('Authorization'), 'Bearer migration-fixture');
    return Response.json({ fixture: true });
  };
  try {
    const response = await onRequest({ request: incoming });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { fixture: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
