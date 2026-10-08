import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const status = require('../api/billing/status.js');
const checkout = require('../api/billing/checkout.js');

async function invoke(handler, method) {
  let body;
  const res = { setHeader() {}, end(value) { body = JSON.parse(value); } };
  await handler({ method, headers: { authorization: 'Bearer test-session' }, body: {} }, res);
  return { code: res.statusCode, body };
}
function account(t, metadata, subscription = null) {
  const previous = { ...process.env };
  Object.assign(process.env, { SUPABASE_URL: 'https://auth.example.test', SUPABASE_ANON_KEY: 'test', STRIPE_SECRET_KEY: 'test' });
  t.after(() => {
    for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'STRIPE_SECRET_KEY']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  });
  const calls = [];
  t.mock.method(global, 'fetch', async url => {
    calls.push(url);
    if (url.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'account', email: 'test@example.test', ...metadata }) };
    if (url.includes('/customers')) return { ok: true, json: async () => ({ data: subscription ? [{ id: 'cus_test', metadata: { supabase_user_id: 'account' } }] : [] }) };
    if (url.includes('/subscriptions?')) return { ok: true, json: async () => ({ data: [{ status: subscription, created: 1 }] }) };
    throw new Error(`Unexpected request: ${url}`);
  });
  return calls;
}
test('billing API honors an administrator grant without contacting Stripe', async t => {
  const calls = account(t, { app_metadata: { unlimited: true } });
  const { code, body } = await invoke(status, 'GET');
  assert.equal(code, 200);
  assert.equal(body.isUnlimited, true);
  assert.equal(body.isPro, true);
  assert.deepEqual(body.features, { unlimitedDotTypes: true, unlimitedCalendars: true, diarySharing: true, billingPortal: false });
  assert.equal(calls.length, 1);
});
test('granted account cannot start another purchase', async t => {
  const calls = account(t, { app_metadata: { unlimited: true } });
  const { code, body } = await invoke(checkout, 'POST');
  assert.equal(code, 409);
  assert.equal(body.error, 'You already have Unlimited.');
  assert.equal(calls.length, 1);
});
test('user-editable metadata does not grant paid access', async t => {
  account(t, { user_metadata: { unlimited: true } });
  const { code, body } = await invoke(status, 'GET');
  assert.equal(code, 200);
  assert.equal(body.isUnlimited, false);
});
test('paid subscriptions retain Unlimited access', async t => {
  account(t, {}, 'active');
  const { code, body } = await invoke(status, 'GET');
  assert.equal(code, 200);
  assert.equal(body.isUnlimited, true);
  assert.equal(body.features.billingPortal, true);
});
