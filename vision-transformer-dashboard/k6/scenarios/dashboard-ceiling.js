/**
 * Stepwise load test: 50 → 80 → 100 → 120 VUs (sequential plateaus).
 * Finds the highest concurrent user count that meets SLOs on the current target.
 */
import http from 'k6/http';
import { sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { resolveTarget, apiPath } from '../lib/config.js';
import { checkDashboardPage, checkSimulationsList } from '../lib/checks.js';

const target = resolveTarget();
const LEVELS = (__ENV.CEILING_LEVELS || '50,80,100,120')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);
const PLATEAU_DURATION = __ENV.PLATEAU_DURATION || '2m';
const GAP_SEC = Number(__ENV.PLATEAU_GAP_SEC || '15');
const POLL_INTERVAL_SEC = Number(__ENV.POLL_INTERVAL_SEC || '1');
const SESSION_POLLS = Number(__ENV.SESSION_POLLS || '10');

function plateauSeconds(duration) {
  const m = String(duration).match(/^(\d+)(s|m|h)$/);
  if (!m) return 120;
  const n = Number(m[1]);
  if (m[2] === 'm') return n * 60;
  if (m[2] === 'h') return n * 3600;
  return n;
}

function buildScenarios(levels) {
  const scenarios = {};
  let startSec = 0;
  const plateauSec = plateauSeconds(PLATEAU_DURATION);

  for (const vus of levels) {
    const name = `ceiling_${vus}`;
    scenarios[name] = {
      executor: 'constant-vus',
      vus,
      duration: PLATEAU_DURATION,
      startTime: `${startSec}s`,
      exec: 'dashboardViewer',
      tags: { vu_level: String(vus), role: 'dashboard_viewer' },
    };
    startSec += plateauSec + GAP_SEC;
  }
  return scenarios;
}

function buildThresholds(levels) {
  const thresholds = {};
  for (const vus of levels) {
    const s = `ceiling_${vus}`;
    thresholds[`http_req_failed{scenario:${s}}`] = ['rate<0.02'];
    thresholds[`checks{scenario:${s}}`] = ['rate>0.98'];
    thresholds[`http_req_duration{scenario:${s}}`] = ['p(95)<3000'];
  }
  return thresholds;
}

export const options = {
  scenarios: buildScenarios(LEVELS),
  thresholds: buildThresholds(LEVELS),
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  tags: { test: 'dashboard-ceiling', target: target.name },
};

export function setup() {
  console.log(
    `[k6 ceiling] levels=${LEVELS.join('→')} plateau=${PLATEAU_DURATION} gap=${GAP_SEC}s polls=${SESSION_POLLS}\n` +
      `             BASE_URL=${target.baseUrl}`,
  );
  return { ...target, levels: LEVELS };
}

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

function scenarioPassed(metrics, scenarioName) {
  const keys = [
    `http_req_failed{scenario:${scenarioName}}`,
    `checks{scenario:${scenarioName}}`,
    `http_req_duration{scenario:${scenarioName}}`,
  ];
  const details = {};
  let ok = true;

  for (const key of keys) {
    const metric = metrics[key];
    if (!metric?.thresholds) {
      details[key] = { ok: false, reason: 'no metric data' };
      ok = false;
      continue;
    }
    for (const [expr, result] of Object.entries(metric.thresholds)) {
      details[`${key} ${expr}`] = { ok: result.ok };
      if (!result.ok) ok = false;
    }
  }
  return { ok, details };
}

function metricSnapshot(metrics, scenarioName) {
  const failedKey = `http_req_failed{scenario:${scenarioName}}`;
  const durationKey = `http_req_duration{scenario:${scenarioName}}`;
  const checksKey = `checks{scenario:${scenarioName}}`;

  return {
    http_req_failed_rate: metrics[failedKey]?.values?.rate ?? null,
    checks_pass_rate: metrics[checksKey]?.values?.rate ?? null,
    http_req_duration_p95: metrics[durationKey]?.values?.['p(95)'] ?? null,
  };
}

export function handleSummary(data) {
  const levels = LEVELS;
  const rows = [];
  let maxPassingVu = 0;

  for (const vus of levels) {
    const scenarioName = `ceiling_${vus}`;
    const { ok, details } = scenarioPassed(data.metrics, scenarioName);
    const snapshot = metricSnapshot(data.metrics, scenarioName);
    if (ok) maxPassingVu = vus;
    rows.push({
      vus,
      scenario: scenarioName,
      passed: ok,
      ...snapshot,
      thresholds: details,
    });
  }

  const report = {
    target: target.name,
    baseUrl: target.baseUrl,
    testedAt: new Date().toISOString(),
    levels,
    plateauDuration: PLATEAU_DURATION,
    sessionPolls: SESSION_POLLS,
    pollIntervalSec: POLL_INTERVAL_SEC,
    slo: {
      http_req_failed: 'rate < 2%',
      checks: 'rate > 98%',
      http_req_duration_p95: '< 3000ms',
    },
    maxPassingVu,
    recommendedLocalCeiling: maxPassingVu,
    results: rows,
  };

  const lines = [
    '',
    '=== Dashboard load ceiling ===',
    `Target: ${report.baseUrl} (${report.target})`,
    `Max VUs meeting SLOs: ${maxPassingVu || 'none'}`,
    '',
    'Level | Pass | Fail%  | Checks% | p95 (ms)',
    '------|------|--------|---------|----------',
  ];

  for (const row of rows) {
    const failPct = row.http_req_failed_rate != null ? (row.http_req_failed_rate * 100).toFixed(2) : 'n/a';
    const checkPct = row.checks_pass_rate != null ? (row.checks_pass_rate * 100).toFixed(2) : 'n/a';
    const p95 = row.http_req_duration_p95 != null ? row.http_req_duration_p95.toFixed(0) : 'n/a';
    lines.push(
      `${String(row.vus).padStart(5)} | ${row.passed ? ' YES' : '  NO'} | ${failPct.padStart(6)} | ${checkPct.padStart(7)} | ${p95}`,
    );
  }
  lines.push('');

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }) + lines.join('\n'),
    'k6-ceiling-report.json': JSON.stringify(report, null, 2),
  };
}
