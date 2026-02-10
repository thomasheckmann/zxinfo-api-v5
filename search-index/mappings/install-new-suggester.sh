#!/bin/bash

usage()
{
    echo ""
    echo "usage:"
    echo "    ./install-new-suggester --target [prod|qa|local] --version <zxdb version>"
    exit 1
}

if [ $# -eq 0 ]
  then
    echo "No arguments supplied"
    usage
fi

POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --target)
      TARGET="$2"
      shift # past argument
      shift # past value
      ;;
    --version)
      ZXDB_VERSION="$2"
      shift # past argument
      shift # past value
      ;;
    -*|--*)
      echo "Unknown option $1"
      usage
      exit 1
      ;;
    *)
      POSITIONAL_ARGS+=("$1") # save positional arg
      shift # past argument
      ;;
  esac
done
set -- "${POSITIONAL_ARGS[@]}" # restore positional parameters

if [[ -z $TARGET || -z $ZXDB_VERSION ]];
then
    echo "'target' or 'version' is missing"
    usage
fi

case "$TARGET" in
    prod|qa|local)
        ;;
    *)
        echo "wrong 'target' value, must be one of [prod|qa|local]"
        usage
        ;;
esac

# abort if any command in this script fails...
set -e 
set -o pipefail

# initialize nvm environment
. ~/.nvm/nvm.sh

if [[ $TARGET == "prod" ]];
then
    ES_HOST="http://internal.zxinfo.dk"
    ES_PATH="/e"
else
    ES_HOST="http://localhost:9400"
    ES_PATH=""
fi

NODE_VERSION="v20.16.0"

echo $(date) "RUNTIME for $TARGET"
echo $(date) "NODE version: $NODE_VERSION"
echo $(date) "ZXDB version: $ZXDB_VERSION"
echo $(date) "Elasticsearch: $ES_HOST$ES_PATH"

# create new index and get index name for later use
INDEX_SUGGESTER=$(ES_HOST=$ES_HOST$ES_PATH ./create_index.sh 2>/dev/null | grep -o '^NEW INDEX.*:.*zxinfo-search-[[:digit:]]\+-[[:digit:]]\+'| grep -o 'zxinfo-search.*')

echo $(date) "new index created: [$INDEX_SUGGESTER]"

pushd ../

echo $(date) "Activate required node version"
nvm use $NODE_VERSION

echo $(date) "Creating new Suggerster Index: $ES_HOST$ES_PATH/$INDEX_SUGGESTER"
ES_HOST="$ES_HOST" ES_PATH="$ES_PATH" ZXDB=zxdb-$ZXDB_VERSION node index.js > zxdb-$ZXDB_VERSION.log

echo $(date) "Getting current INDEX using alias: zxinfo-search"
INDEX_CURRENT=$(curl -X GET  "$ES_HOST$ES_PATH/_cat/aliases/zxinfo-search" 2>/dev/null | grep -o 'zxinfo-search-[[:digit:]]\+-[[:digit:]]\+' || true)
echo -e $(date) "\t=>$INDEX_CURRENT"

if [[ -z $INDEX_CURRENT ]];
then
    echo $(date) "NO Current Index, skipping alias delete"
else 
    echo $(date) "Deleting 'zxinfo-search' alias from $INDEX_CURRENT"
    curl -X DELETE "$ES_HOST$ES_PATH/$INDEX_CURRENT/_alias/zxinfo-search"
fi

echo $(date) "Activating zxinfo-search alias on index: $INDEX_SUGGESTER"
curl -X POST -H "Content-Type: application/json" -d '{"actions":[{"add":{"index":"'$INDEX_SUGGESTER'","alias":"zxinfo-search"}}]}' "$ES_HOST$ES_PATH/_aliases"

popd

echo $(date) "### DONE ###"
exit 0
