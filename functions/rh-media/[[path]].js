import { proxy } from '../../cloudflare/proxy.js';

export const onRequest = ({ request }) => {
  const incoming = new URL(request.url);
  const upstream = new URL('https://rh-images-1252422369.cos.ap-beijing.myqcloud.com');
  upstream.pathname = incoming.pathname.slice('/rh-media/'.length);
  upstream.search = incoming.search;
  return proxy(request, upstream);
};
