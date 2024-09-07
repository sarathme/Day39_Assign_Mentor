const { MongoClient, ObjectId } = require("mongodb");
const { catchAsync } = require("../utils/catchAsync");
const AppError = require("./../utils/appError");

const url = process.env.DB_CONNECTION.replace(
  "<PASSWORD>",
  process.env.DB_PASSWORD
);
const client = new MongoClient(url);

exports.getAllMentors = catchAsync(async (req, res, next) => {
  await client.connect();
  const database = client.db("guvi_mentor");
  const mentorsCollection = database.collection("mentors");
  const mentors = await mentorsCollection.find({}).toArray();
  await client.close();
  res.status(200).json({
    status: "success",
    data: {
      mentors,
    },
  });
});

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

exports.addStudent = catchAsync(async (req, res, next) => {
  await client.connect();
  const database = client.db("guvi_mentor");
  const mentors = database.collection("mentors");
  const students = database.collection("students");

  // This try catch is to handle if invalid format of Object id is specified
  let studentObjectId;
  let mentorObjectId;
  try {
    studentObjectId = new ObjectId(req.params.studentId);
  } catch (err) {
    console.error("Error: ", err);
    next(new AppError("No student found with the provided id", 404));
    await client.close();
    return;
  }

  try {
    mentorObjectId = new ObjectId(req.params.mentorId);
  } catch (err) {
    console.error("Error: ", err);
    next(new AppError("No mentor found with the provided id", 404));
    await client.close();
    return;
  }

  const student = await students.findOne({
    _id: studentObjectId,
  });

  if (!student) {
    next(new AppError("No student found with the provided id", 404));
    await client.close();
    return;
  } else if (student.mentorId) {
    next(
      new AppError(
        "The provided student is already assigned with a mentor. Try updating the mentor on behalf of the student",
        400
      )
    );
    await client.close();
    return;
  }

  let mentor = await mentors.findOneAndUpdate(
    {
      _id: mentorObjectId,
    },
    { $push: { students: req.params.studentId } }
  );

  if (!mentor) {
    next(new AppError("No mentor found with the provided id", 404));
    await client.close();
    return;
  }
  await students.findOneAndUpdate(
    { _id: studentObjectId },
    { $set: { mentorId: mentorObjectId } }
  );
  mentor = await mentors.findOne({
    _id: mentorObjectId,
  });

  res.status(200).json({
    status: "success",
    data: {
      mentor,
    },
  });
});
