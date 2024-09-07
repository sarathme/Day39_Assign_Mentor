const express = require("express");

const mentorRouter = require("./routes/mentorRoutes");
const studentRouter = require("./routes/studentRoutes");
const globalErrorHandler = require("./controllers/errorController");

const app = express();

// Middleware to attach body to request object and parse JSON.
app.use(express.json());

// ROUTES

app.use("/api/v1/mentors", mentorRouter);
app.use("/api/v1/students", studentRouter);

app.use(globalErrorHandler);
module.exports = app;
