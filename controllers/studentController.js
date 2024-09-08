const { MongoClient, ObjectId } = require("mongodb");
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

exports.changeMentorOfStudent = catchAsync(async (req, res, next) => {
  await client.connect();
  const database = client.db("guvi_mentor");

  let mentor;
  let student;
  if (ObjectId.isValid(req.params.mentorId)) {
    mentor = await database
      .collection("mentors")
      .findOne({ _id: new ObjectId(req.params.mentorId) });
  } else {
    next(new AppError("No mentor found with the provided id", 404));
    await client.close();
    return;
  }

  if (ObjectId.isValid(req.params.studentId)) {
    student = await database
      .collection("students")
      .findOne({ _id: new ObjectId(req.params.studentId) });
  } else {
    next(new AppError("No student found with the provided id", 404));
    await client.close();
    return;
  }

  if (student.mentorId?.equals(mentor._id)) {
    next(
      new AppError(
        "The student provided is already a mentee of the mentor",
        400
      )
    );
    await client.close();
    return;
  }

  if (!student.mentorId) {
    await database
      .collection("students")
      .findOneAndUpdate(
        { _id: student._id },
        { $set: { mentorId: mentor._id } }
      );

    await database
      .collection("mentors")
      .findOneAndUpdate(
        { _id: mentor._id },
        { $push: { studentIds: student._id } }
      );
  } else {
    await database
      .collection("mentors")
      .findOneAndUpdate(
        { _id: student.mentorId },
        { $pull: { studentIds: student._id } }
      );

    await database.collection("students").findOneAndUpdate(
      { _id: student._id },
      {
        $push: { previousMentors: student.mentorId },
        $set: { mentorId: mentor._id },
      }
    );
  }

  res.status(200).json({
    status: "success",
    data: {
      mentor,
      student,
    },
  });
});
