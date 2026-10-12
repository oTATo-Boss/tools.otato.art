import handler from '../../../api/rh/query.js';

export const onRequest = ({ request }) => handler.fetch(request);
