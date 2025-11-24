# Deployment

How to run locally and containerize for deployment.

## Local

- `npm start` — injects env to `public/config.js` then starts CRA dev server
- `.env` for local development; see `.env.example`

## Docker

- `Dockerfile` builds a production image
- `docker-compose.yml` wires the frontend with environment and optional reverse proxy
- `nginx.conf` used for static file serving in container

## Build

- `npm run build` — outputs to `build/`
- Ensure `public/config.js` is generated in production (see `import-env.sh` and `entrypoint.sh`)

## Environment

- Inject runtime variables (backend URLs, tiles) to avoid hardcoding at build time

