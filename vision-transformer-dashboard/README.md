# Vision Transformer Dashboard

Angular 20 application with server-side rendering (SSR). The UI loads simulation metrics from the **collision-risk-backend** Express API. During development and in production, the dashboard calls `/api/...`; the Angular SSR server proxies those requests to the backend (see `src/server.ts` and `proxy.conf.json`).

## Prerequisites

- Node.js 20+ and npm
- Optional: Docker, kubectl, and a Kubernetes cluster (for container deployment)

## Install dependencies

From this directory:

```bash
npm install
```

The API lives in `collision-risk-backend/`. Install it separately when you run the backend locally:

```bash
cd collision-risk-backend && npm install && cd ..
```

## Local development

1. Start the API (listens on port **4000** by default):

   ```bash
   cd collision-risk-backend
   npm start
   ```

2. In another terminal, from the dashboard root, start the dev server:

   ```bash
   ng serve
   ```

   Open `http://localhost:4200/`. Requests to `/api/*` are proxied to `http://127.0.0.1:4000` via `proxy.conf.json`.

## Production build and SSR server

Build client and server bundles:

```bash
ng build
```

Run the Node SSR app (use a free port if the API is still on 4000):

```bash
set PORT=8080
set COLLISION_RISK_API_URL=http://127.0.0.1:4000
node dist/vision-transformer-dashboard/server/server.mjs
```

On Linux or macOS, use `export` instead of `set`. In PowerShell, use `$env:PORT=8080` and `$env:COLLISION_RISK_API_URL='http://127.0.0.1:4000'`.

- **`PORT`** — port for the SSR HTTP server (default in code is 4000 if unset).
- **`COLLISION_RISK_API_URL`** — base URL of the collision-risk API (default `http://127.0.0.1:4000`).

## Docker

Build images from the dashboard root (`vision-transformer-dashboard/`):

```bash
docker build -t collision-risk-backend:latest ./collision-risk-backend
docker build -t vision-transformer-dashboard:latest .
```

The dashboard image sets `PORT=8080` and `COLLISION_RISK_API_URL=http://collision-risk-backend:4000` for use behind Kubernetes service DNS.

## Kubernetes

Manifests and a Kustomize entry point are under `k8s/`. They assume the image tags above exist in the cluster (or on the node, with `imagePullPolicy: IfNotPresent`).

```bash
kubectl apply -k k8s/
```

This creates the `vision-dashboard` namespace, deploys both services, and adds an Ingress for host **`vision-dashboard.local`** (point that name at your ingress controller or add a hosts file entry).

Without Ingress, you can port-forward the dashboard service:

```bash
kubectl port-forward -n vision-dashboard svc/vision-transformer-dashboard 8080:80
```

Then open `http://localhost:8080/`.

## Code scaffolding

```bash
ng generate component component-name
ng generate --help
```

## Tests

```bash
ng test
```

End-to-end testing is not configured by default; add a runner that fits your workflow if you need it.

## Additional resources

- [Angular CLI](https://angular.dev/tools/cli)
