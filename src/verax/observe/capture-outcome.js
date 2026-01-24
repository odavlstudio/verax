/**
 * Canonical capture outcome shape for evidence sensors.
 * status: success | partial | failed
 * data: captured payload or null
 * error: { message } or null
 * sensor: logical sensor name
 * stage: optional stage identifier (matches evidence capture stages)
 */
export function captureOutcome({ sensor, status, data = null, error = null, stage = null }) {
  return {
    sensor,
    status,
    data,
    error: error ? { message: error.message || String(error) } : null,
    stage
  };
}

export function captureSuccess(sensor, data = null, stage = null) {
  return captureOutcome({ sensor, status: 'success', data, error: null, stage });
}

export function capturePartial(sensor, data = null, error = null, stage = null) {
  return captureOutcome({ sensor, status: 'partial', data, error, stage });
}

export function captureFailure(sensor, message, stage = null) {
  return captureOutcome({
    sensor,
    status: 'failed',
    data: null,
    error: { message },
    stage
  });
}
