import { onRequest as proxyMedia } from '../../../apps/rh-studio/functions/rh-media-hk/[[path]].js';

export const onRequest = ({ request }) => {
  const upstreamRequest = new URL(request.url);
  upstreamRequest.pathname = upstreamRequest.pathname.slice('/rh-studio'.length);
  return proxyMedia({ request: new Request(upstreamRequest, request) });
};
