const { MongoClient } = require("mongodb");
const { catchAsync } = require("../utils/catchAsync");
const AppError = require("./../utils/appError");

const url = process.env.DB_CONNECTION.replace(
  "<PASSWORD>",
  process.env.DB_PASSWORD
);

const client = new MongoClient(url);

exports.createStudent = catchAsync(async (req, res, next) => {
  // Connecting and selecting the student collection in database.

  await client.connect();
  const database = client.db("guvi_mentor");
  const students = database.collection("students");

  // Querying any student available with the requested email.

  const studentsArr = await students
    .find({
      email: { $eq: req.body.email },
    })
    .toArray();

  let student;
  // If no student found. Add the sent student to database.

  if (!studentsArr.length) {
    const created = await students.insertOne(req.body);
    student = await students.findOne({ _id: created.insertedId });
    await client.close();
  } else {
    // If email is present in database send a error response as student already exists.

    next(new AppError(`Email: ${req.body.email} already exists`, 400));
    await client.close();
    return;
  }

  // Sending the created user in the response.

  res.status(201).json({
    status: "success",
    data: {
      student,
    },
  });
});
