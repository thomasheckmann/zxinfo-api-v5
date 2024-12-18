const express = require("express");
const app = express();

// Use environment variable or default to port 3000
const port = process.env.PORT || 3000;

// Import the router
const routes = require("./v5/routes");
const appConfig = require("./v5/config.json");

if (process.env.NODE_ENV === undefined) {
  console.log("NODE_ENV not defined, must be 'development' or 'production'");
  console.log("assuming 'development'");
  process.env['NODE_ENV'] = 'development';
}

console.log("# APP START ###################################################");
console.log("# RUNNING in mode: " + process.env.NODE_ENV);
console.log("# nodeJS version: " + process.version);
console.log("#");
console.log("# CONFIG DUMP #################################################");
console.log(JSON.stringify(appConfig[process.env.NODE_ENV], null, 2));
console.log("###############################################################");
console.log("#");

// Use the router for all paths starting with '/'
app.use("/v5", routes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
