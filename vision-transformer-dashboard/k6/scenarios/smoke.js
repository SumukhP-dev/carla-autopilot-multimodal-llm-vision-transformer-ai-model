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

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
  tags: { test: 'smoke', target: target.name },
};

export function setup() {
  console.log(`[k6 smoke] target=${target.name} base=${target.baseUrl} api=${target.apiBase}`);
  return target;
}

export default function (data) {
  const base = data.baseUrl;
  const api = data.apiBase;

  const home = http.get(`${base}/`);
  checkDashboardPage(home);

  const list = http.get(apiPath(api, '/api/simulations'), {
    headers: { Accept: 'application/json' },
  });
  checkSimulationsList(list);

  const post = http.post(
    apiPath(api, '/api/simulations'),
    JSON.stringify(buildSimulationPayload(__VU, __ITER)),
    { headers: { 'Content-Type': 'application/json' } },
  );
  checkSimulationPost(post);

  sleep(1);
}
