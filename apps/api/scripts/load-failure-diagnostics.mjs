// Never record request paths, identities, headers, tickets, or arbitrary response bodies.
const OPERATIONS = new Set(['create', 'renew', 'channels', 'manifest', 'segment']);
const REASONS = new Set(['AUTH_SESSION_CHECK_UNAVAILABLE', 'PLAYBACK_POLICY_UNAVAILABLE', 'NO_RIGHTS_ELIGIBLE_HEALTHY_SOURCE', 'UPSTREAM_MEDIA_UNAVAILABLE_REFRESH_MANIFEST']);
export function loadFailureDiagnostic(operation, error) {
  const response = error?.response;
  const status = response?.status;
  const body = response?.body;
  const reason = typeof body?.message === 'string' ? body.message : body?.error;
  return {
    operation: OPERATIONS.has(operation) ? operation : 'unknown',
    http_status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    reason: REASONS.has(reason) ? reason : null,
  };
}
