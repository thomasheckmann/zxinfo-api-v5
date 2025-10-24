# zxinfo-api-v5
ZXInfo v5 API - for accessing data in ZXDB

## Changes to Elasticserch
```
Index names uses '-' dashes instead of '_' underscore.
Index name zxinfo-games => zxinfo
```

Keeping zxinfo-magazine

## First - build Elasticsearch 8.17.0-alpine image
```
docker build -t zxinfo/es:8.17.0 .
docker run -p 9200:9200 zxinfo/es:8.17.0
```

OR use docker compose
```
docker compose up -d
```

# Create search-index


## Import zxinfo
cd es-import && ./import_zxinfo.sh

## RUN API for development
```
nvm use v20.16.0
DEBUG=zxinfo-api* node node_modules/nodemon/bin/nodemon.js
```
