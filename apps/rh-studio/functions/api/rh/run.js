import handler from '../../../api/rh/run.js';

export const onRequest = ({ request }) => handler.fetch(request);
