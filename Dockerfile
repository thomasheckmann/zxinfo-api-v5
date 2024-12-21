# docker build -t foo . && docker run -d foo
FROM node:20.18.1-alpine

# update
RUN apk upgrade && apk --no-cache add --virtual native-deps g++ gcc libgcc libstdc++ linux-headers make python3
RUN apk add curl
RUN npm install -g node-gyp

RUN mkdir /app
WORKDIR /app
COPY package.json /app
COPY app.js /app
COPY v5 /app/v5

RUN npm install

# clean up
RUN apk del native-deps

# install import files
RUN mkdir /es-import
COPY es-import/*.txt /es-import/
COPY es-import/package.json /es-import/
COPY es-import/import_zxinfo.sh /es-import/
COPY es-import/import_magazines.sh /es-import/
COPY es-import/import_search.sh /es-import/
WORKDIR /es-import
RUN sed -i 's/localhost/zxinfo-es-v8/g' /es-import/import_zxinfo.sh
RUN sed -i 's/localhost/zxinfo-es-v8/g' /es-import/import_magazines.sh
RUN sed -i 's/localhost/zxinfo-es-v8/g' /es-import/import_search.sh
RUN npm install

# get ready to launch API
WORKDIR /app

CMD ["node","app.js"]