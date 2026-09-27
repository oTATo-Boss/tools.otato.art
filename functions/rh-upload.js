import { proxy } from '../cloudflare/proxy.js';

export const onRequest = ({ request }) =>
  proxy(request, 'https://www.runninghub.ai/openapi/v2/media/upload/binary');
