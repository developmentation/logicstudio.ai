//For Admins, use this to generate a JWT signing secret if you dont have one already
// const crypto = require('crypto');
// const secret = crypto.randomBytes(64).toString('hex');
// console.log('signing secret', secret)

//Establish local environment variables
const dotenv = require("dotenv").config();

//Create the app object
const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const url = require("url");

//Handles both WSS and Socket.IO depending on the Client's request
const { createRealTimeServers } = require("./realTime");

//Process JSON and urlencoded parameters
app.use(express.json({ extended: true, limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" })); //The largest incoming payload

//Select the default port
const port = process.env.PORT || 3000;

//Bring in the logger
//const expressLogger = require("../middleware/expressLogger");
//app.use(expressLogger);

//Create HTTP Server
const server = http.createServer(app);
server.listen( port, '0.0.0.0', () =>
  console.log(`LogicStudio.ai - Node.js service listening at http://localhost:${port}`)
);

//Establish both websocket and Socket.IO servers
createRealTimeServers(server, null);

app.use((req, res, next) => {
  req.fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
  next();
});




//Export the app for use on the index.js page
module.exports = { app };
