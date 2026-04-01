# zxinfo-api-v5
ZXInfo v5 API - for accessing data in ZXDB

## API Documentation

Swagger UI (GitHub Pages):

https://thomasheckmann.github.io/zxinfo-api-v5/

## Changes to Elasticsearch
```
Index names use '-' dashes instead of '_' underscores.
Index name zxinfo-games => zxinfo
```

Keeping zxinfo-magazine.

## First - build Elasticsearch 8.17.0-alpine image
```
docker build -t zxinfo/es:8.17.0 .
docker run -p 9200:9200 zxinfo/es:8.17.0
```

OR use docker compose
```
docker compose -f docker-compose.yml.not-used up -d
```

Set NODE_ENV and other compose environment values:
```
cp .env.example .env
# then edit .env (for example NODE_ENV=development)

docker compose -f docker-compose.yml.not-used up -d --build
```

Notes:
- `NODE_ENV` is not hardcoded in the Docker image and is provided at runtime by Compose (`NODE_ENV: ${NODE_ENV:-production}`).
- `PORT`, `API_PORT`, `ES_HTTP_PORT`, and `ES_TRANSPORT_PORT` are also configurable via `.env`.

# Create search-index


## Import zxinfo
cd es-import && ./import_zxinfo.sh

## RUN API for development
```
nvm use v22
DEBUG=zxinfo-api* node node_modules/nodemon/bin/nodemon.js
```

## Production container hardening
Use these runtime controls in addition to the hardened Dockerfile.

If you run the container without Compose and want a specific environment mode, pass it explicitly:
```
docker run -d --name zxinfo-api-v5 -e NODE_ENV=production -p 3000:3000 zxinfo-api-v5:test
```

Docker CLI example:
```
docker run -d \
	--name zxinfo-api-v5 \
	--read-only \
	--tmpfs /tmp:rw,noexec,nosuid,size=64m \
	--cap-drop ALL \
	--security-opt no-new-privileges:true \
	--pids-limit 200 \
	--memory 512m \
	--cpus 1.0 \
	-p 3000:3000 \
	zxinfo-api-v5:test
```

Docker Compose recommendations:
```
services:
	zxinfo-api-v5:
		build:
			context: ./
		environment:
			NODE_ENV: ${NODE_ENV:-production}
			PORT: ${PORT:-3000}
		ports:
			- "${API_PORT:-8400}:${PORT:-3000}"
		read_only: true
		tmpfs:
			- /tmp:rw,noexec,nosuid,size=64m
		cap_drop:
			- ALL
		security_opt:
			- no-new-privileges:true
		pids_limit: 200
		mem_limit: 512m
		cpus: 1.0
```

Kubernetes recommendations:
```
securityContext:
	allowPrivilegeEscalation: false
	readOnlyRootFilesystem: true
	runAsNonRoot: true
	capabilities:
		drop: ["ALL"]
resources:
	requests:
		cpu: "250m"
		memory: "256Mi"
	limits:
		cpu: "1"
		memory: "512Mi"
```
