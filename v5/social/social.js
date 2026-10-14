/**
 * NODE_ENV=development PORT=8300 DEBUG=zxinfo-api-v3:social* nodemon --ignorpublic/javascripts/config.js --exec npm start
 * 
 * nginx configuration:
        # if facebook or MS Teams - rewrite to /social service
        set $social 0;
        if ($http_user_agent ~* "facebookexternalhit|SkypeUriPreview") {
                set $social 1;
        }

    # media files excluded
        if ($request_uri ~ "media") {
                set $social 0;
        }
        if ($social = 1) {
                rewrite ^/(.*)$ /social/$1 break;
    }
 * 
 */

import debugLib from "debug";
import express from "express";
import { Jimp, JimpMime } from "jimp";

import { elasticClient, config } from "../common/elastic.js";
import { es_source_item } from "../common/utils.js";

const moduleId = "social";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const debugTrace = debugLib(`zxinfo-api-v5:${moduleId}:trace`);
const debugError = debugLib(`zxinfo-api-v5:${moduleId}:error`);
const router = express.Router();

const formatLogValue = (value) => {
  if (value === undefined || value === null) {
    return "n/a";
  }
  const text = String(value);
  return text.includes(" ") ? JSON.stringify(text) : text;
};

const logEvent = (logger, fields) => {
  const message = Object.entries(fields)
    .map(([key, value]) => `${key}=${formatLogValue(value)}`)
    .join(" ");
  logger(message);
};

const getRequestUrl = (req, path) => {
  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https" ? forwardedProtocol : req.protocol;
  return new URL(path, `${protocol}://${req.get("host")}`).href;
};

const getSocialRequestUrl = (req, path) => {
  const mountPath = req.baseUrl.replace(/\/$/, "");
  return getRequestUrl(req, `${mountPath}${path}`);
};

const loadPreviewImage = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      throw new Error(`Image request returned ${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 10 * 1024 * 1024) {
      throw new Error("Image exceeds the 10 MB dimension-check limit");
    }

    return await Jimp.read(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    logEvent(debugError, {
      level: "error",
      event: "image.load.failed",
      module: moduleId,
      imageUrl,
      errType: err.name,
      errMessage: err.message,
    });
    return null;
  }
};

const getFacebookImageDimensions = (image) => {
  const scale = Math.max(1, 200 / image.bitmap.width, 200 / image.bitmap.height);
  return {
    width: Math.ceil(image.bitmap.width * scale),
    height: Math.ceil(image.bitmap.height * scale),
  };
};

const normalizeGameId = (rawId) => {
  const value = String(rawId ?? "");
  return /^[0-9]{1,7}$/.test(value) ? value.padStart(7, "0") : null;
};

const getHTML = (title, titleLong, description, url, imageUrl, imageWidth, imageHeight, imageType) => {
  let html = `<html><head><title>${title}</title>`;
  html += `<meta property="og:url" content="${url}" />`;
  html += `<meta property="og:type" content="website" />`;
  html += `<meta property="og:title" content="${titleLong}" />`;
  html += `<meta property="og:description" content="${description}" />`;
  html += `<meta property="og:image" content="${imageUrl}" />`;
  html += `<meta property="og:image:width" content="${imageWidth}">`;
  html += `<meta property="og:image:height" content="${imageHeight}">`;
  html += `<meta property="og:image:type" content="${imageType}" />`;
  html += `</head><body>`;
  html += `<h1>${titleLong}</h1>`;
  html += `<h2>${description}</h2>`;
  html += `<br/><img src="${imageUrl}" width="${imageWidth}" height="${imageHeight}"></img><br/>${imageUrl}<br/>`;
  html += `<div>`;
  html += `</div>`;
  html += `</body></html >`;
  return html;
};

const getGameById = (gameId) => {
  logEvent(debugTrace, {
    level: "trace",
    event: "entry.lookup",
    module: moduleId,
    entryId: gameId,
  });
  return elasticClient.get({
    _source_includes: es_source_item("tiny"),
    _source_excludes: ["titlesuggest", "publishersuggest", "authorsuggest", "metadata_author", "metadata_publisher"],
    index: config.index_entries,
    id: gameId,
  });
};

const loadscreen = (source) => {
  // iterate all additionals to find loading screen, if any
  let screenUrl = "/images/placeholder.png";
  if (source.genreType == "Compilation") {
    screenUrl = "/media/images/compilation.png";

    /** Try to find Inlay for compilation - in additionals */
    const inlays = [];
    const additionalDownloads = source.additionalDownloads || [];
    for (let i = 0; i < additionalDownloads.length; i++) {
      const item = additionalDownloads[i];
      if (item.type.indexOf("inlay") != -1 && item.format.startsWith("Picture")) {
        /** Ignore 'Back' */
        if (item.path.indexOf("Back") == -1) {
          inlays.push(item);
        }
      }
    }
    if (inlays.length > 0) {
      screenUrl = inlays[0].path.replace("/pub/sinclair/", "/thumbs/");
    } else if (source.screens?.length) {
      screenUrl = source.screens[0].url;
    } else {
      /* no inlay found, and no running screens */
      screenUrl = "/images/compilation.png";
    }
  }

  if (source.genreType === "Hardware") {
    if (source.screens?.length && source.screens[0].url) {
    } else if (source.additionalDownloads) {
      screenUrl = null;
      for (let addIdx = 0; addIdx < source.additionalDownloads.length; addIdx++) {
        const hwItem = source.additionalDownloads[addIdx];
        if (hwItem.type === "Hardware picture" && hwItem.format === "Picture (JPG)" && !screenUrl) {
          screenUrl = hwItem.path;
        }
      }
      if (!screenUrl) {
        screenUrl = "/images/placeholder.png";
      }
    }
  }

  if (source.screens?.length && source.screens[0].url && source.genreType !== "Compilation") {
    screenUrl = source.screens[0].url;
    screenUrl = screenUrl.replace("/pub/sinclair/books-pics", "/thumbs/books-pics");
    screenUrl = "/media" + screenUrl;
  } else {
    screenUrl = "/media" + screenUrl;
  }

  return screenUrl;
};

/************************************************
 *
 * common to use for all requests
 *
 ************************************************/
router.use((req, res, next) => {
  console.log(`[social] ${req.method} user-agent: '${req.headers["user-agent"]}' ${req.originalUrl}`);
  logEvent(debug, {
    level: "info",
    event: "module.middleware",
    module: moduleId,
    path: req.path,
    method: req.method,
    userAgent: req.headers["user-agent"],
  });
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

/************************************************
 *
 * requests served by this endpoint
 *
 ************************************************/

//TODO: handle id without trailing 0s
router.get("/details/:gameid", async (req, res) => {
  const route = "/details/:gameid";
  logEvent(debug, {
    level: "info",
    event: "request.start",
    module: moduleId,
    route,
    method: req.method,
    path: req.path,
  });
  const rawId = String(req.params.gameid ?? "");
  const id = normalizeGameId(rawId);
  if (id === null) {
    logEvent(debugError, {
      level: "error",
      event: "request.validation.failed",
      module: moduleId,
      route,
      errMessage: "Invalid entry ID",
      status: 404,
    });
    return res.status(404).end();
  }

  try {
    const result = await getGameById(id);
    const source = result._source;
    const imageUrl = getRequestUrl(req, loadscreen(source));
    const sourceImage = await loadPreviewImage(imageUrl);
    let imageType = "image/jpeg";
    if (imageUrl.endsWith("png")) {
      imageType = "image/png";
    } else if (imageUrl.endsWith("gif")) {
      imageType = "image/gif";
    }

    let description;
    if (source.machineType === null) {
      description = `${source.genreType} - ${source.publishers[0].name}(${source.originalYearOfRelease})`;
    } else {
      description = `${source.machineType}, ${source.genre}`;
      if (source.publishers) {
        description += ` - ${source.publishers[0].name}`;
      }
      if (source.originalYearOfRelease) {
        description += `(${source.originalYearOfRelease})`;
      }
    }

    let shareImageUrl = imageUrl;
    let imageDimensions;
    if (sourceImage) {
      imageDimensions = getFacebookImageDimensions(sourceImage);
      if (imageDimensions.width !== sourceImage.bitmap.width || imageDimensions.height !== sourceImage.bitmap.height) {
        shareImageUrl = getSocialRequestUrl(req, `/image/${id}`);
        imageType = "image/png";
      }
    } else {
      shareImageUrl = getRequestUrl(req, "/media/icons/android-chrome-512x512.png");
      imageDimensions = { width: 512, height: 512 };
      imageType = "image/png";
    }

    const html = getHTML(
      `${source.title} | ZXInfo.dk`,
      source.title,
      description,
      getRequestUrl(req, `/details/${rawId}`),
      shareImageUrl,
      imageDimensions.width,
      imageDimensions.height,
      imageType
    );
    logEvent(debug, {
      level: "info",
      event: "request.response.sent",
      module: moduleId,
      route,
      status: 200,
      entryId: id,
    });
    return res.send(html);
  } catch (err) {
    const status = err.statusCode === 404 ? 404 : 500;
    logEvent(debugError, {
      level: "error",
      event: "request.error",
      module: moduleId,
      route,
      errType: err.name,
      errMessage: err.message,
      status,
    });
    return res.status(status).end();
  }
});

router.get("/image/:gameid", async (req, res) => {
  const route = "/image/:gameid";
  const id = normalizeGameId(req.params.gameid);
  if (id === null) {
    return res.status(404).end();
  }

  try {
    const result = await getGameById(id);
    const image = await loadPreviewImage(getRequestUrl(req, loadscreen(result._source)));
    if (!image) {
      return res.status(404).end();
    }

    const dimensions = getFacebookImageDimensions(image);
    if (dimensions.width !== image.bitmap.width || dimensions.height !== image.bitmap.height) {
      image.resize({ w: dimensions.width, h: dimensions.height });
    }
    const png = await image.getBuffer(JimpMime.png);
    return res.type("png").set("Cache-Control", "public, max-age=3600").send(png);
  } catch (err) {
    const status = err.statusCode === 404 ? 404 : 500;
    logEvent(debugError, {
      level: "error",
      event: "request.error",
      module: moduleId,
      route,
      entryId: id,
      errType: err.name,
      errMessage: err.message,
      status,
    });
    return res.status(status).end();
  }
});

router.get("/search/:query", (req, res) => {
  debug(`social.js /search/ - ${req.query}]`);

  const queryString = Object.keys(req.query)
    .map((key) => {
      return key + "=" + encodeURIComponent(req.query[key]);
    })
    .join("&");

  const description = queryString;
  const html = getHTML(
    "ZXInfo",
    "The open source ZXDB frontend",
    `Keyword: ${req.params.query}`,
    getRequestUrl(req, `/search/${encodeURIComponent(req.params.query)}?${description}`),
    getRequestUrl(req, "/media/icons/android-chrome-512x512.png"),
    "512",
    "512",
    "image/png"
  );

  res.send(html);
});

router.get("/publisher/:name", async (req, res) => {
  debug(`social.js /publisher/ - ${req.params.name}]`);

  let description = "Publisher: " + req.params.name;
  try {
    const endpoint = `/v5/entries/bypublisher/${encodeURIComponent(req.params.name)}?mode=tiny&size=0&offset=0&titlesonly=false`;
    const apiUrl = new URL(endpoint, `http://127.0.0.1:${process.env.PORT || 3000}`);
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      throw new Error(`Title count request returned ${response.status}`);
    }
    const total = response.headers.get("x-total-count");
    if (total === null || !/^\d+$/.test(total)) {
      throw new Error("Title count response has no valid X-Total-Count header");
    }
    description += ` - ${total} titles found`;
  } catch (err) {
    logEvent(debugError, {
      level: "error",
      event: "publisher.count.failed",
      module: moduleId,
      publisher: req.params.name,
      errType: err.name,
      errMessage: err.message,
    });
  }
  const html = getHTML(
    "ZXInfo",
    "The open source ZXDB frontend",
    description,
    getRequestUrl(req, `/publisher/${encodeURIComponent(req.params.name)}`),
    getRequestUrl(req, "/media/icons/android-chrome-512x512.png"),
    "512",
    "512",
    "image/png"
  );

  res.send(html);
});

router.get("/author/:name", async (req, res) => {
  debug(`social.js /author/ - ${req.params.name}]`);

  let description = "Author: " + req.params.name;
  try {
    const endpoint = `/v5/entries/byauthor/${encodeURIComponent(req.params.name)}?mode=tiny&includeagg=true&size=21&offset=0&titlesonly=false`;
    const apiUrl = new URL(endpoint, `http://127.0.0.1:${process.env.PORT || 3000}`);
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      throw new Error(`Title count request returned ${response.status}`);
    }
    const total = response.headers.get("x-total-count");
    if (total === null || !/^\d+$/.test(total)) {
      throw new Error("Title count response has no valid X-Total-Count header");
    }
    description += ` - ${total} titles found`;
  } catch (err) {
    logEvent(debugError, {
      level: "error",
      event: "author.count.failed",
      module: moduleId,
      author: req.params.name,
      errType: err.name,
      errMessage: err.message,
    });
  }
  const html = getHTML(
    "ZXInfo",
    "The open source ZXDB frontend",
    description,
    getRequestUrl(req, `/author/${encodeURIComponent(req.params.name)}`),
    getRequestUrl(req, "/media/icons/android-chrome-512x512.png"),
    "512",
    "512",
    "image/png"
  );

  res.send(html);
});

router.get("/letter/:letter", async (req, res) => {
  debug(`social.js /letter/ - ${req.params.letter}]`);

  let description = "Games starting with " + (req.params.letter === '#' ? "number" : " letter: " + req.params.letter);
  try {
    const endpoint = `/v5/entries/byletter/${encodeURIComponent(req.params.letter)}?mode=tiny&size=0&offset=0`;
    const apiUrl = new URL(endpoint, `http://127.0.0.1:${process.env.PORT || 3000}`);

    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Title count request returned ${response.status}`);
    }
    const total = response.headers.get("x-total-count");
    if (total === null || !/^\d+$/.test(total)) {
      throw new Error("Title count response has no valid X-Total-Count header");
    }
    description += ` - ${total} titles found`;
  } catch (err) {
    logEvent(debugError, {
      level: "error",
      event: "letter.count.failed",
      module: moduleId,
      letter: req.params.letter,
      errType: err.name,
      errMessage: err.message,
    });
  }
  const html = getHTML(
    "ZXInfo",
    "The open source ZXDB frontend",
    description,
    getRequestUrl(req, `/letter/${encodeURIComponent(req.params.letter)}`),
    getRequestUrl(req, "/media/icons/android-chrome-512x512.png"),
    "512",
    "512",
    "image/png"
  );

  res.send(html);
});

const sendDefaultPreview = (req, res) => {
  // function getHTML(title, title_long, description, url, img_url, img_width, img_height, img_type) {

  const html = getHTML(
    "ZXInfo",
    "ZXInfo - The open source ZXDB frontend",
    "Provides a fantastic desktop and mobile friendly interface to search and browse the ZXDB catalogue for almost all Spectrum software, hardware and books ever released.",
    getRequestUrl(req, "/"),
    getRequestUrl(req, "/media/icons/android-chrome-512x512.png"),
    "512",
    "512",
    "image/png"
  );

  return res.send(html);
};

router.get("/", sendDefaultPreview);
router.get("/*", sendDefaultPreview);

export default router;
