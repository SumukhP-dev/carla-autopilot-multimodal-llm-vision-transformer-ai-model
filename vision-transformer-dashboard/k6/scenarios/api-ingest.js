/**
 * Backend-only load: collision-risk API under Docker/K8s without SSR.
 * Use API_BASE_URL=http://localhost:4000 or in-cluster service URL.
 */
import http from 'k6/http';
import { sleep } from 'k6';
import { resolveTarget, apiPath } from '../lib/config.js';
import { buildSimulationPayload } from '../lib/payloads.js';
import { checkSimulationsList, checkSimulationPost } from '../lib/checks.js';

const target = resolveTarget();

export const options = {
  scenarios: {
    read_heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '4m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      exec: 'readSimulations',
      tags: { role: 'api_read' },
    },
    write_steady: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '5m30s',
      preAllocatedVUs: 50,
      maxVUs: 80,
      exec: 'writeSimulation',
      tags: { role: 'api_write' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    checks: ['rate>0.98'],
    'http_req_duration{role:api_read}': ['p(95)<1500'],
    'http_req_duration{role:api_write}': ['p(95)<2000'],
  },
  tags: { test: 'api-ingest', target: target.name },
};

export function setup() {
  const api = target.apiBase;
  console.log(`[k6 api-ingest] API_BASE=${api}`);
  return { apiBase: api };
}

export function readSimulations(data) {
  const res = http.get(apiPath(data.apiBase, '/api/simulations'), {
    headers: { Accept: 'application/json' },
    tags: { name: 'GET /api/simulations' },
  });
  checkSimulationsList(res);
  sleep(0.5);
}

export function writeSimulation(data) {
  const res = http.post(
    apiPath(data.apiBase, '/api/simulations'),
    JSON.stringify(buildSimulationPayload(__VU, __ITER)),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /api/simulations' },
    },
  );
  checkSimulationPost(res);
}
