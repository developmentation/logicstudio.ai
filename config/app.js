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

// Add Ollama proxy route
app.post('/api/ollama/:model', async (req, res) => {
    try {
        const response = await fetch(`http://localhost:11434/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: req.params.model,
                prompt: req.body.prompt,
                stream: false
            }),
        });
        
        const data = await response.json();
        res.json({ text: data.response });
    } catch (error) {
        console.error('Ollama API error:', error);
        res.status(500).json({ error: 'Failed to communicate with Ollama' });
    }
});

const ollamaRoutes = require('../server/routes/ollama');

// Add Ollama routes
app.use('/api/ollama', ollamaRoutes);

//Export the app for use on the index.js page
module.exports = { app };
