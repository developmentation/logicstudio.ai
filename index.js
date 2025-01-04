const express = require("express");
const path = require("path");
const { app } = require("./config/app.js");

// Custom error handling
const apiErrorHandler = require("./error/apiErrorHandler");

// Middleware to parse incoming JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from specific directories
app.use("/composables", express.static(path.join(__dirname, "public/composables")));
app.use("/components", express.static(path.join(__dirname, "public/components")));
app.use(express.static(path.join(__dirname, "public"))); // Serve other static assets

// Middleware to ensure proper MIME types for .js files
app.use((req, res, next) => {
  if (req.path.endsWith(".js")) {
    res.setHeader("Content-Type", "application/javascript");
  }
  next();
});

// API routes (ensure these are defined first)
// We are only assuming endpoints stating with /api/ 
app.use("/api/healthcheck", require("./routes/healthcheck")); // Healthcheck route
app.use("/api/configs", require("./routes/configs")); // Configuration values
app.use("/api/transcribe", require("./routes/transcribe")); // Configuration values

// SPA Fallback: Serve `index.html` for any non-API routes
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).send({ error: "API route not found" });
  } else {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

// 404 error handler for unrecognized routes
app.use((req, res, next) => {
  const error = new Error("This site was not found. Perhaps you want to call login?");
  error.status = 404;
  next(error);
});

// API error handler
app.use(apiErrorHandler);
