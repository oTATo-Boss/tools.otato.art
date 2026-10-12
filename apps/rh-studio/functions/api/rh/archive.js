import handler from '../../../api/rh/archive.js';

export const onRequest = ({ request }) => handler.fetch(request);
