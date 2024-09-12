const express = require("express");

const mentorRouter = require("./routes/mentorRoutes");
const studentRouter = require("./routes/studentRoutes");
const globalErrorHandler = require("./controllers/errorController");
const AppError = require("./utils/appError");

const app = express();

// Middleware to attach body to request object and parse JSON.
app.use(express.json());

// ROUTES

app.use("/api/v1/mentors", mentorRouter);
app.use("/api/v1/students", studentRouter);

// RESPONSE FOR UNHANDLED ROUTES.

app.use("*", (req, res, next) => {
  next(new AppError("This route is not defined", 404));
});

// CREATING A MIDDLEWARE TO HANDLE GLOBAL ERRORS WITHING EXPRESS.

app.use(globalErrorHandler);
module.exports = app;
