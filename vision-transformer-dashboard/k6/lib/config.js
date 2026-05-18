/**
 * Deployment targets for containerized ML dashboard load tests.
 * Override with env: BASE_URL, API_BASE_URL, K6_TARGET
 */
const TARGETS = {
  local: {
    baseUrl: 'http://localhost:8080',
    description: 'Docker / local SSR (PORT=8080); use localhost for SSR + proxy',
  },
  dev: {
    baseUrl: 'http://localhost:4200',
    description: 'ng serve with proxy.conf.json',
  },
  k8s: {
    baseUrl: 'http://vision-dashboard.local',
    description: 'Kubernetes Ingress (kubectl apply -k k8s/)',
  },
  azure: {
    baseUrl: 'https://vision-transformer-dashboard.azurewebsites.net',
    description: 'Azure Web App (GitHub Actions deploy)',
  },
  aws: {
    baseUrl: 'http://localhost:8080',
    description: 'EKS/ALB — set AWS_DASHBOARD_URL',
  },
  backend: {
    baseUrl: 'http://localhost:4000',
    description: 'collision-risk-backend only (Docker/K8s service)',
  },
};

export function resolveTarget() {
  const name = (__ENV.K6_TARGET || 'local').toLowerCase();
  const preset = TARGETS[name] || TARGETS.local;

  const baseUrl = (__ENV.BASE_URL || preset.baseUrl).replace(/\/$/, '');
  const apiBase = (__ENV.API_BASE_URL || baseUrl).replace(/\/$/, '');

  if (name === 'aws' && __ENV.AWS_DASHBOARD_URL) {
    return {
      name,
      baseUrl: String(__ENV.AWS_DASHBOARD_URL).replace(/\/$/, ''),
      apiBase: (__ENV.API_BASE_URL || __ENV.AWS_DASHBOARD_URL).replace(/\/$/, ''),
      description: TARGETS.aws.description,
    };
  }

  return {
    name,
    baseUrl,
    apiBase,
    description: preset.description,
  };
}

export function apiPath(apiBase, path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${normalized}`;
}
