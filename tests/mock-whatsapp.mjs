// Only preloaded by integration tests against their disposable database.
if (process.env.BPBD_INTEGRATION_TEST !== '1' || !/^bpbd_test_[a-f0-9]+$/.test(process.env.PGDATABASE || '')) throw new Error('WhatsApp mock only supports the isolated integration database.');
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith('https://graph.facebook.com/')) throw new Error('Unexpected test request');
  const body=JSON.parse(options.body);
  if(body.messaging_product!=='whatsapp'||body.type!=='template'||!body.to)throw new Error('Invalid WhatsApp payload');
  return Response.json({messages:[{id:'wamid.integration-test'}]});
};
