import { proxy } from '../../cloudflare/proxy.js';

export const onRequest = ({ request }) => {
  const incoming = new URL(request.url);
  const upstream = new URL('https://rh-hk-images-1252422369.cos.ap-hongkong.myqcloud.com');
  upstream.pathname = incoming.pathname.slice('/rh-media-hk/'.length);
  upstream.search = incoming.search;
  return proxy(request, upstream);
};
