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

## UPDATE zxinfo-api-v5 
Make sure you have latest version of ZXDB running on your local machine - and a local instance of Elasticsearch, if creating index for local use.

```
cd ~/Public/HETZNER_SITES/NEW_ZXINFO/zxinfo-api-v5/search-index/mappings
prod> ES_HOST=http://internal.zxinfo.dk/e ./create_index.sh
local> ES_HOST=http://localhost:9400 ./create_index.sh

# NOTE the new INDEX name - needed later
# NEW INDEX             :  zxinfo-search-20250103-194951
# creates new zxinfo-search-XXXXXX index
# creates alias zxinfo-searcj-write for new index

cd ..

# specify which node version to use
nvm use v20.16.0

# ES_HOST=URL for elasticsearch, defaults to localhost:9200
# ES_PATH=path, defaults to /
# ZXDB=name of local ZXDB database, defaults to zxdb
prod> ES_HOST=http://internal.zxinfo.dk ES_PATH="/e" ZXDB=zxdb-1.0.212 node index.js
local> ES_HOST=http://localhost:9400 ES_PATH="" ZXDB=zxdb-1.0.212 node index.js

# list current index for 'zxinfo-search', note index name
curl -X GET 'http://internal.zxinfo.dk/e817/_alias/zxinfo-search?pretty'
=>
{
  "zxinfo-search-20250103-175249" : {
    "aliases" : {
      "zxinfo-search" : { }
    }
  }
}
# remove zxinfo-search alias from existing index
curl -X DELETE 'http://internal.zxinfo.dk/e817/zxinfo-search-20250103-175249/_alias/zxinfo-search?pretty'

# create alias zxinfo-search for new INDEX (NEW INDEX from above)
curl -X PUT 'http://internal.zxinfo.dk/e817/zxinfo-search-20250103-194951/_alias/zxinfo-search?pretty'

```

```
cd search-index

cd mappings && ./create_index.sh

node index.js
```

## Import zxinfo
cd es-import && ./import_zxinfo.sh

## RUN API for development
```
nvm use v20.16.0
DEBUG=zxinfo-api* node node_modules/nodemon/bin/nodemon.js
```
