# docker build -t foo . && docker run -d foo

ARG NODE_IMAGE=node:22-alpine@sha256:4d64b49e6c891c8fc821007cb1cdc6c0db7773110ac2c34bf2e6960adef62ed3

FROM ${NODE_IMAGE} AS app-deps
WORKDIR /app

# Build deps are only needed to compile native modules during install.
RUN apk add --no-cache --virtual .build-deps g++ gcc libstdc++ linux-headers make python3

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


FROM ${NODE_IMAGE} AS import-deps
WORKDIR /es-import

COPY es-import/package.json es-import/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


FROM ${NODE_IMAGE}
WORKDIR /app

COPY --from=app-deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node app.js ./
COPY --chown=node:node v5 ./v5

WORKDIR /es-import
COPY --from=import-deps /es-import/node_modules ./node_modules
COPY es-import/*.txt ./
COPY es-import/package.json ./
COPY es-import/import_zxinfo.sh ./
COPY es-import/import_magazines.sh ./
COPY es-import/import_search.sh ./
RUN sed -i 's/localhost/zxinfo-es-v8/g' import_zxinfo.sh \
 && sed -i 's/localhost/zxinfo-es-v8/g' import_magazines.sh \
 && sed -i 's/localhost/zxinfo-es-v8/g' import_search.sh

WORKDIR /app
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
	CMD node -e "const http=require('node:http');const port=process.env.PORT||3000;const req=http.get({host:'127.0.0.1',port,path:'/v5/healthz',timeout:2000},res=>process.exit(res.statusCode<500?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"
CMD ["node", "app.js"]