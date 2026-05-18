/**
 * Load test: 120 concurrent dashboard users (100+ requirement).
 * Mimics Angular SSR + 1 Hz polling of /api/simulations (see simulations.ts).
 */
import http from 'k6/http';
import { sleep } from 'k6';
import { resolveTarget, apiPath } from '../lib/config.js';
import { buildSimulationPayload } from '../lib/payloads.js';
import {
  checkDashboardPage,
  checkSimulationsList,
  checkSimulationPost,
} from '../lib/checks.js';

const target = resolveTarget();
const POLL_INTERVAL_SEC = Number(__ENV.POLL_INTERVAL_SEC || '1');
const SESSION_POLLS = Number(__ENV.SESSION_POLLS || '30');

export const options = {
  scenarios: {
    dashboard_viewers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 120 },
        { duration: '5m', target: 120 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'dashboardViewer',
      tags: { role: 'dashboard_viewer' },
    },
    simulator_ingest: {
      executor: 'constant-vus',
      vus: 20,
      duration: '8m',
      startTime: '1m',
      exec: 'simulatorIngest',
      tags: { role: 'simulator_ingest' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    checks: ['rate>0.98'],
    'http_req_duration{role:dashboard_viewer}': ['p(95)<3000'],
    'http_req_duration{role:simulator_ingest}': ['p(95)<2000'],
    'http_reqs{expected_response:true}': ['rate>0.98'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  tags: { test: 'dashboard-100-users', target: target.name },
};

export function setup() {
  console.log(
    `[k6] ${target.description}\n` +
      `     BASE_URL=${target.baseUrl}\n` +
      `     API_BASE=${target.apiBase}\n` +
      `     VUs peak=120 ingest=20 poll=${POLL_INTERVAL_SEC}s`,
  );
  return target;
}

/** SSR page load + sustained API polling like production dashboard users. */
export function dashboardViewer(data) {
  const base = data.baseUrl;
  const api = data.apiBase;

  const home = http.get(`${base}/`, { tags: { name: 'GET /' } });
  checkDashboardPage(home);

  for (let i = 0; i < SESSION_POLLS; i++) {
    const list = http.get(apiPath(api, '/api/simulations'), {
      headers: { Accept: 'application/json' },
      tags: { name: 'GET /api/simulations' },
    });
    checkSimulationsList(list);
    sleep(POLL_INTERVAL_SEC);
  }
}

/** CARLA simulators pushing metrics (POST /api/simulations). */
export function simulatorIngest(data) {
  const api = data.apiBase;
  const payload = buildSimulationPayload(__VU, __ITER);

  const res = http.post(apiPath(api, '/api/simulations'), JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /api/simulations' },
  });
  checkSimulationPost(res);

  sleep(2);
}
