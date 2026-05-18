# Run k6 load tests against the vision-transformer dashboard stack.
# Requires: https://grafana.com/docs/k6/latest/set-up/install-k6/
param(
  [ValidateSet('smoke', 'dashboard', 'api', 'ceiling')]
  [string]$Scenario = 'smoke',
  [ValidateSet('local', 'dev', 'k8s', 'azure', 'aws', 'backend')]
  [string]$Target = 'local',
  [string]$BaseUrl = '',
  [string]$ApiBaseUrl = '',
  [string]$SummaryPath = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$ScenarioFile = switch ($Scenario) {
  'smoke' { 'k6/scenarios/smoke.js' }
  'dashboard' { 'k6/scenarios/dashboard-100-users.js' }
  'api' { 'k6/scenarios/api-ingest.js' }
  'ceiling' { 'k6/scenarios/dashboard-ceiling.js' }
}

$env:K6_TARGET = $Target
if ($BaseUrl) { $env:BASE_URL = $BaseUrl }
if ($ApiBaseUrl) { $env:API_BASE_URL = $ApiBaseUrl }

$k6Args = @('run', (Join-Path $Root $ScenarioFile))
if ($SummaryPath) {
  $k6Args += @('--summary-export', $SummaryPath)
}

Write-Host "k6 scenario=$Scenario target=$Target workingDir=$Root"
Push-Location $Root
try {
  & k6 @k6Args
} finally {
  Pop-Location
}
