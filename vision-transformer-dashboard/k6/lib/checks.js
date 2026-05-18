import { check } from 'k6';

export function checkDashboardPage(res) {
  return check(res, {
    'dashboard HTML status 200': (r) => r.status === 200,
    'dashboard returns HTML': (r) =>
      (r.headers['Content-Type'] || '').includes('text/html') || r.body.length > 100,
  });
}

export function checkSimulationsList(res) {
  let parsed = [];
  try {
    parsed = res.json();
  } catch {
    parsed = null;
  }

  return check(res, {
    'GET /api/simulations status 200': (r) => r.status === 200,
    'GET /api/simulations is JSON array': () => Array.isArray(parsed),
  });
}

export function checkSimulationPost(res) {
  return check(res, {
    'POST /api/simulations status 2xx': (r) => r.status >= 200 && r.status < 300,
    'POST response has message': (r) => {
      try {
        const body = r.json();
        return typeof body.message === 'string';
      } catch {
        return false;
      }
    },
  });
}
