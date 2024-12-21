#!/bin/bash
ES_HOST=localhost
ES_PORT=9200

INDEX_NAME=zxinfo-search

WRITE_INDEX=`date "+${INDEX_NAME}-%Y%m%d-%H%M%S"`
WRITE_ALIAS="${INDEX_NAME}-write"

DUMP_CMD="./node_modules/elasticdump/bin/elasticdump";

echo 'Elasticsearch host: ' $ES_HOST
echo 'Elasticsearch port: ' $ES_PORT
echo 'Index/Type        : ' $INDEX_NAME
echo 'Index             : ' ${WRITE_INDEX}
echo 'Index_alias       : ' ${WRITE_ALIAS}

## ZXINFO
echo '-- create ' $WRITE_INDEX
$DUMP_CMD \
  --input=zxinfo-search.mappings.txt \
  --output=http://${ES_HOST}:${ES_PORT}/${WRITE_INDEX} \
  --type=mapping \
  --headers='{"Content-Type": "application/json"}'


echo '-- remove all alias for ' $WRITE_ALIAS
curl -H'Content-Type: application/json' -XPOST "http://${ES_HOST}:${ES_PORT}/_aliases" -d '
{
    "actions" : [
        { "remove" : { "index" : "*", "alias" : "'$WRITE_ALIAS'" } }
    ]
}'; echo ""

echo '-- create alias ' $WRITE_ALIAS ' for index ' $WRITE_INDEX
curl -H'Content-Type: application/json' -XPOST "http://${ES_HOST}:${ES_PORT}/_aliases" -d '
{
    "actions" : [
        { "add" : { "index" : "'$WRITE_INDEX'", "alias" : "'$WRITE_ALIAS'" } }
    ]
}'; echo ""

echo '-- importing data into ' $WRITE_ALIAS
$DUMP_CMD \
  --input=zxinfo-search.index.txt \
  --output=http://${ES_HOST}:${ES_PORT}/${WRITE_ALIAS} \
  --type=data \
  --headers='{"Content-Type": "application/json"}'


## wait
read -n1 -r -p "Press space to swith to new index..." key

echo '-- remove all alias for ' ${INDEX_NAME}
curl -H'Content-Type: application/json' -XPOST "http://${ES_HOST}:${ES_PORT}/_aliases" -d '
{
    "actions" : [
        { "remove" : { "index" : "*", "alias" : "'${INDEX_NAME}'" } }
    ]
}'; echo ""

echo "Switching to new INDEX ${WRITE_INDEX} for ALIAS ${INDEX_NAME}"
curl -H'Content-Type: application/json' -XPOST "http://${ES_HOST}:${ES_PORT}/_aliases" -d '
{
    "actions" : [
        { "add" : { "index" : "'$WRITE_INDEX'", "alias" : "'$INDEX_NAME'" } }
    ]
}'

# curl http://${ES_HOST}:${ES_PORT}/_cat/indices?v
# curl http://${ES_HOST}:${ES_PORT}/_cat/aliases?v
# curl http://${ES_HOST}:${ES_PORT}/zxinfo_games/_doc/0002259
echo ""
echo "test: curl http://${ES_HOST}:${ES_PORT}/zxinfo-search/_doc/0000051 | jq"
