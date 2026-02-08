# UPDATE ZXInfo API v5 Suggester
Ensure that the latest version of [ZXDB is running on your local machine](https://github.com/spectrumcomputing-co-uk/spectrumcomputing/blob/main/DOC/UPDATE_ZXDB.md), along with a local instance of Elasticsearch if you’re creating the index for local use.

````
# PRODUCTION | LOCAL
>cd ~/Public/HETZNER_SITES/NEW_ZXINFO/zxinfo-api-v5/search-index/mappings
>./install-new-suggester.sh --target prod --version 1.0.231 | ./install-new-suggester.sh --target local --version 1.0.231
````

<details>
<summary>Details for the update process:</summary>
````bash
# PROD | LOCAL
> cd ~/Public/HETZNER_SITES/NEW_ZXINFO/zxinfo-api-v5/search-index/mappings
> ES_HOST=http://internal.zxinfo.dk/e ./create_index.sh | ES_HOST=http://localhost:9400 ./create_index.sh

# NOTE the new INDEX name - needed later
# NEW INDEX             :  zxinfo-search-20250103-194951
# creates new zxinfo-search-XXXXXX index
# creates alias zxinfo-searcj-write for new index

# specify which node version to use
> cd ~/Public/HETZNER_SITES/NEW_ZXINFO/zxinfo-api-v5/search-index && nvm use v20.16.0

# ES_HOST=URL for elasticsearch, defaults to localhost:9200
# ES_PATH=path, defaults to /
# ZXDB=name of local ZXDB database, defaults to zxdb
> ES_HOST=http://internal.zxinfo.dk ES_PATH="/e" ZXDB=zxdb-1.0.212 node index.js | ES_HOST=http://localhost:9400 ES_PATH="" ZXDB=zxdb-1.0.212 node index.js
````
A new suggester index has been created with the alias `zxinfo-search-write`. Check with `elasitvue`.
To switch to the updated index, assign the alias `zxinfo-search` to it and remove the alias from the previous index.

# Rebuild ZXInfo API v5

````bash
> cd /home/docker/ZXINFO
> UID_GID="$(id -u):$(id -g)" docker compose -p zxinfo up -d --no-deps --build zxinfo-api-v5
````


````
# list current index for 'zxinfo-search', note index name (or use elasicvue)
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

````

```
cd search-index

cd mappings && ./create_index.sh

node index.js
```
</details>


