#!/bin/sh
if [ -z "${ES_HOST}" ];
then
ES_HOST=http://localhost:9200
fi

INDEX_NAME=zxinfo-search
WRITE_INDEX=`date "+${INDEX_NAME}-%Y%m%d-%H%M%S"`
WRITE_ALIAS="${INDEX_NAME}-write"

echo 'Elasticsearch host: ' $ES_HOST
echo 'Index/Type        : ' $INDEX_NAME
echo 'Index             : ' ${WRITE_INDEX}
echo 'Index_alias       : ' ${WRITE_ALIAS}

echo ""
echo "-- creating Elasticsearch index for zxinfo-search: ${WRITE_INDEX}"
curl -X PUT "${ES_HOST}/${WRITE_INDEX}" -H 'Content-Type: application/json' -d '@zxinfo-search.mappings.json'
echo ""
echo ""

echo '-- remove alias ' $WRITE_ALIAS from all index
curl -H'Content-Type: application/json' -XPOST "${ES_HOST}/_aliases" -d '
{
    "actions" : [
        { "remove" : { "index" : "*", "alias" : "'$WRITE_ALIAS'" } }
    ]
}'; echo ""

# echo '-- remove all alias for ' ${INDEX_NAME}
# curl -H'Content-Type: application/json' -XPOST "${ES_HOST}/_aliases" -d '
# {
#     "actions" : [
#         { "remove" : { "index" : "*", "alias" : "'${INDEX_NAME}'" } }
#     ]
# }'
# echo ""
# echo ""

# echo "Switching to new alias for INDEX ${WRITE_INDEX} for ALIAS ${INDEX_NAME}"
# curl -H'Content-Type: application/json' -XPOST "${ES_HOST}/_aliases" -d '
# {
#     "actions" : [
#         { "add" : { "index" : "'$WRITE_INDEX'", "alias" : "'$INDEX_NAME'" } }
#     ]
# }'
# echo ""
# echo ""

echo '-- create new write alias ' $WRITE_ALIAS ' for index ' $WRITE_INDEX
curl -H'Content-Type: application/json' -XPOST "${ES_HOST}/_aliases" -d '
{   
    "actions" : [
        { "add" : { "index" : "'$WRITE_INDEX'", "alias" : "'$WRITE_ALIAS'" } }
    ]
}'; echo ""

echo ""
echo ""
echo 'NEW INDEX             : ' ${WRITE_INDEX}
echo 'NEW WRITE ALIAS       : ' ${WRITE_ALIAS}
