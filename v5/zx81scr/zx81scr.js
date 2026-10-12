import debugLib from "debug";
import express from "express";
import { Jimp, JimpMime } from "jimp";
import multer from "multer";
import path from "node:path";
import zx81 from "./zx81scr_utils.js";

const moduleId = "zx81scr";
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

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["bmp", "png", "gif", "jpg", "s81", "s80", "scr"];
  const extension = file.originalname.substring(file.originalname.lastIndexOf(".") + 1).toLowerCase();

  if (!allowedTypes.includes(extension)) {
    const error = new Error("Incorrect file");
    error.code = "INCORRECT_FILETYPE";
    return cb(error, false);
  }
  cb(null, true);
};

const uploadPath = path.resolve("./uploads");
let upload;
try {
  upload = multer({ dest: uploadPath, fileFilter, limits: { fileSize: 1000000 } });
} catch (error) {
  console.log(`[${moduleId}] Failed to initialize upload destination "${uploadPath}"`, error);
  throw error;
}

router.use((req, res, next) => {
  console.log(`[zx81scr] ${req.method} ${req.originalUrl}`);
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

router.post("/upload", upload.single("file"), async (req, res, next) => {
  logEvent(debug, {
    level: "info",
    event: "request.start",
    module: moduleId,
    route: "/upload",
    method: req.method,
    path: req.path,
    filename: req.file?.originalname,
  });

  const offsetx = parseInt(req.query.ox);
  const offsety = parseInt(req.query.oy);
  let model = "ZX81";
  if (req.query.zx80 === "true") {
    model = "ZX80";
  }

  logEvent(debugTrace, {
    level: "trace",
    event: "request.options",
    module: moduleId,
    offsetx,
    offsety,
    model,
  });

  const name = req.file.originalname.split(".").slice(0, -1).join(".");
  if (
    req.file.originalname.toLowerCase().endsWith(".bmp") ||
    req.file.originalname.toLowerCase().endsWith(".png") ||
    req.file.originalname.toLowerCase().endsWith(".gif") ||
    req.file.originalname.toLowerCase().endsWith(".jpg")
  ) {
    try {
      const image = await Jimp.read(req.file.path);
      logEvent(debugTrace, {
        level: "trace",
        event: "image.loaded",
        module: moduleId,
        width: image.bitmap.width,
        height: image.bitmap.height,
      });
      const r = await zx81.convertBMP(req.file.originalname, image, offsetx, offsety, model);
      const img = await r.png.getBase64(JimpMime.png);
      return res.json({
        output: {
          png: { base64: img, height: image.bitmap.height, width: image.bitmap.width, filename: name + ".png" },
          ovr: { filename: name + "_ovr.png" },
          s81: { filename: name + (model === "ZX81" ? ".s81" : ".s80") },
          scr: { filename: name + ".scr" },
          txt: { filename: name + ".txt", data: r.txt },
          used_offsetx: r.used_offsetx,
          used_offsety: r.used_offsety,
        },
        file: req.file,
      });
    } catch (err) {
      return next(err);
    }
  } else if (req.file.originalname.toLowerCase().endsWith(".s81") || req.file.originalname.toLowerCase().endsWith(".s80")) {
    model = "ZX81";
    if (req.file.originalname.toLowerCase().endsWith(".s80")) {
      model = "ZX80";
    }
    try {
      const r = await zx81.convertS81(req.file, offsetx, offsety, model);
      const img = await r.png.getBase64(JimpMime.png);
      return res.json({
        output: {
          png: { base64: img, height: r.png.bitmap.height, width: r.png.bitmap.width, filename: name + ".png" },
          ovr: { filename: name + "_ovr.png" },
          s81: { filename: name + (model === "ZX81" ? ".s81" : ".s80") },
          scr: { filename: name + ".scr" },
          txt: { filename: name + ".txt", data: r.txt },
          used_offsetx: r.used_offsetx,
          used_offsety: r.used_offsety,
        },
        file: req.file,
      });
    } catch (err) {
      return next(err);
    }
  } else if (req.file.originalname.toLowerCase().endsWith(".scr")) {
    try {
      const r = await zx81.convertSCR(req.file, offsetx, offsety);
      const img = await r.png.getBase64(JimpMime.png);
      return res.json({
        output: {
          png: { base64: img, height: r.png.bitmap.height, width: r.png.bitmap.width, filename: name + ".png" },
          ovr: { filename: name + "_ovr.png" },
          s81: { filename: name + ".s81" },
          scr: { filename: name + ".scr" },
          txt: { filename: name + ".txt", data: r.txt },
          used_offsetx: r.used_offsetx,
          used_offsety: r.used_offsety,
        },
        file: req.file,
      });
    } catch (err) {
      return next(err);
    }
  }
});

router.get("/files/:name", (req, res) => {
  logEvent(debug, {
    level: "info",
    event: "request.file.download",
    module: moduleId,
    filename: req.params.name,
  });
  const file = `./uploads/${req.params.name}`;
  res.download(file);
});

router.use((err, req, res, next) => {
  if (err.code === "INCORRECT_FILETYPE") {
    logEvent(debugError, {
      level: "error",
      event: "request.validation.failed",
      module: moduleId,
      errMessage: err.message,
      status: 422,
    });
    res.status(422).json({ error: "Wrong filetype" });
    return;
  }
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    logEvent(debugError, {
      level: "error",
      event: "request.validation.failed",
      module: moduleId,
      errMessage: err.message,
      status: 422,
    });
    res.status(422).json({ error: "Allowed file size is 1000KB" });
    return;
  }
  logEvent(debugError, {
    level: "error",
    event: "request.error",
    module: moduleId,
    errType: err.name,
    errMessage: err.message,
    status: 500,
  });
  next(err);
});

export default router;
