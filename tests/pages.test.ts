import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Small Pages entrypoint is plain JavaScript.
import gateway from '../pages/worker.mjs';
test('Pages preserves the request origin, session cookie and CSRF token', async () => {
  const request = new Request('https://investment-diary.pages.dev/api/profile', {
    method:'POST', headers:{Origin:'https://investment-diary.pages.dev',Cookie:'journal_session=test-token','X-CSRF-Token':'test-csrf'},body:'{}'
  });
  const response = new Response('ok', {headers:{'Set-Cookie':'journal_session=test; HttpOnly; Secure; Path=/'}});
  const result = await gateway.fetch(request, {JOURNAL:{fetch:async (forwarded:Request)=>{
    assert.equal(forwarded, request);
    assert.equal(forwarded.headers.get('Origin'), new URL(forwarded.url).origin);
    assert.equal(forwarded.headers.get('Cookie'), 'journal_session=test-token');
    assert.equal(forwarded.headers.get('X-CSRF-Token'), 'test-csrf');
    return response;
  }}});
  assert.equal(result, response);
});
