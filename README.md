# ZXInfo API v5

An Express API for searching and retrieving ZX Spectrum database (ZXDB) entries. The API reads its data from Elasticsearch and exposes its v5 routes under `/v5`.

## Requirements

- Node.js 22 or newer and npm
- Elasticsearch 8.x, reachable at `http://127.0.0.1:9200` for local development
- `ELASTIC_PASSWORD` set to the password for Elasticsearch's `elastic` user
- ZXInfo Elasticsearch indices populated for data-backed API requests

The development Elasticsearch host and index names are configured in [`v5/config.json`](v5/config.json). The API does not create or populate those indices on startup. The `search-index/` and `es-import/` directories contain related index and import tooling.

## Dependencies

The root `package.json` contains the API runtime dependencies: Express, the Elasticsearch client, MySQL, file-upload and image-processing packages, and supporting utilities. Nodemon is a development dependency. Node.js built-in modules provide the test runner and HTTP debugging support.

## Run Locally

Start Elasticsearch first, with the ZXInfo indices available. Then, from the repository root:

```sh
npm ci
export NODE_ENV=development
export ELASTIC_PASSWORD='your-elasticsearch-password'
npm exec nodemon -- app.js
```

The API listens on port `3000` by default; set `PORT` to use a different port. The root health endpoint is `http://localhost:3000/health`. API routes are under `http://localhost:3000/v5`.

For example, check the metadata route:

```sh
curl http://localhost:3000/v5/metadata
```

For request-level debug logging, enable the `debug` namespace:

```sh
DEBUG=zxinfo-api-v5* NODE_ENV=development ELASTIC_PASSWORD='your-elasticsearch-password' npm exec nodemon -- app.js
```

To attach a debugger from VS Code or another Node inspector client, run the API directly with the inspector enabled:

```sh
NODE_ENV=development ELASTIC_PASSWORD='your-elasticsearch-password' node --inspect app.js
```

The inspector listens on `127.0.0.1:9229` by default. Start the API under the debugger to set breakpoints before startup.

## Tests

The tests make live HTTP requests to an already-running API and expect Elasticsearch data to be present. Start the API and its Elasticsearch service first, then run:

```sh
npm --prefix v5 test
```

Tests target `http://localhost:3000/v5` by default. Set `API_ENDPOINT_URL` to test another host or port, for example:

```sh
API_ENDPOINT_URL=http://localhost:8400/v5 npm --prefix v5 test
```

The root `npm test` script is currently a placeholder and exits with an error; use the `v5` test script above.

## Docker

Build the production image from the repository root:

```sh
docker build -t zxinfo-api-v5 .
```

The container listens on port `3000`. It uses the production Elasticsearch host `elasticsearch:9200`, so connect it to a Docker network containing the Elasticsearch service and provide `ELASTIC_PASSWORD`:

```sh
docker run --rm --name zxinfo-api-v5 \
  -e NODE_ENV=production \
  -e ELASTIC_PASSWORD='your-elasticsearch-password' \
  -p 3000:3000 \
  zxinfo-api-v5
```

The image healthcheck calls `/health`. It reports API process health only; it does not verify Elasticsearch connectivity or index readiness.

## API Documentation

- OpenAPI specification: [`docs/swagger.yml`](docs/swagger.yml)
- Hosted Swagger UI: <https://thomasheckmann.github.io/zxinfo-api-v5/>

## Project Layout

- `app.js`: Express application entry point
- `v5/`: API routes, handlers, configuration, and tests
- `docs/`: OpenAPI specification and documentation site
- `search-index/`: Elasticsearch index setup and search helpers
- `es-import/`: ZXDB and search-data import scripts