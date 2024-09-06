const dotenv = require("dotenv");

const { MongoClient } = require("mongodb");
const { catchAsync } = require("../utils/catchAsync");
const AppError = require("./../utils/appError");
dotenv.config();

const url = process.env.DB_CONNECTION.replace(
  "<PASSWORD>",
  process.env.DB_PASSWORD
);

const client = new MongoClient(url);

exports.createMentor = catchAsync(async (req, res, next) => {
  await client.connect();
  const database = client.db("guvi_mentor");
  const mentors = database.collection("mentors");

  const mentorArr = await mentors
    .find({
      email: { $eq: req.body.email },
    })
    .toArray();
  let mentor;
  if (!mentorArr.length) {
    const created = await mentors.insertOne(req.body);
    mentor = await mentors.findOne({ _id: created.insertedId });
    await client.close();
  } else {
    next(new AppError(`Email: ${req.body.email} already exists`, 400));
    await client.close();
    return;
  }

  res.status(201).json({
    status: "success",
    message: "Mentor created successfully",
    data: {
      mentor,
    },
  });
});
