import handler from '../../../api/rh/upload.js';

export const onRequest = ({ request }) => handler.fetch(request);
