export const onRequest = ({ request, env }) =>
  env.ASSETS.fetch(new Request(new URL('/history.html', request.url), request));
