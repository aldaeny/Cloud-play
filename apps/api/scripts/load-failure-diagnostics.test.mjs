import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFailureDiagnostic } from './load-failure-diagnostics.mjs';

test('reports only allowlisted operation, status and known failure reason', () => {
  assert.deepEqual(loadFailureDiagnostic('renew', { response: { status: 503, body: { message: 'AUTH_SESSION_CHECK_UNAVAILABLE', token: 'secret' } } }),
    { operation: 'renew', http_status: 503, reason: 'AUTH_SESSION_CHECK_UNAVAILABLE' });
});

test('does not disclose arbitrary operation, status, response, or error data', () => {
  assert.deepEqual(loadFailureDiagnostic('/private?ticket=secret', { response: { status: 700, body: { message: 'secret' } }, message: 'secret' }),
    { operation: 'unknown', http_status: null, reason: null });
  assert.deepEqual(loadFailureDiagnostic('manifest', new Error('secret')),
    { operation: 'manifest', http_status: null, reason: null });
});
