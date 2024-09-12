const { MongoClient, ObjectId } = require("mongodb");
const { catchAsync } = require("../utils/catchAsync");
const AppError = require("./../utils/appError");

const url = process.env.DB_CONNECTION.replace(
  "<PASSWORD>",
  process.env.DB_PASSWORD
);

const client = new MongoClient(url);

// HANDLER FUNCTION FOR CREATING A NEW STUDENT.

exports.createStudent = catchAsync(async (req, res, next) => {
  // Connecting and selecting the student collection in database.

  await client.connect();
  const database = client.db("guvi_mentor");
  const students = database.collection("students");

  // Querying any student available with the requested email.

  let student = await students.findOne({
    email: { $eq: req.body.email },
  });

  // If email is present in database send a error response as student already exists.
  if (student) {
    next(new AppError(`Email: ${req.body.email} already exists`, 400));
    await client.close();
    return;
  }
  // If no student found. Add the sent student to database.
  const created = await students.insertOne(req.body);
  student = await students.findOne({ _id: created.insertedId });
  await client.close();
  // Sending the created user in the response.

  res.status(201).json({
    status: "success",
    data: {
      student,
    },
  });
});

// HANDLER FUNCTION TO CHANGE MENTOR OF A STUDENT

exports.changeMentorOfStudent = catchAsync(async (req, res, next) => {
  // Connecting the database and selcting the mentor and student collection.

  await client.connect();
  const database = client.db("guvi_mentor");
  const mentorsCollection = database.collection("mentors");
  const studentsCollection = database.collection("students");

  // Initializing mentor and student variables.

  let mentor;
  let student;

  // Initial check for the url provided mentor id is a valid mongodb id.

  if (ObjectId.isValid(req.params.mentorId)) {
    // Find the mentor using the mentor Id
    mentor = await mentorsCollection.findOne({
      _id: new ObjectId(req.params.mentorId),
    });
  }

  // If there is no mentor found with the id or Invalid mongodb Id then sending an error response of Not Found.

  if (!mentor) {
    next(new AppError("No mentor found with the provided id", 404));
    await client.close();
    return;
  }

  // Initial check for the url provided student id is a valid mongodb id.

  if (ObjectId.isValid(req.params.studentId)) {
    // Find the mentor using the mentor Id
    student = await studentsCollection.findOne({
      _id: new ObjectId(req.params.studentId),
    });
  }
  // If there is no student found with the id or invalid Mongodb Id then sending an error response of Not Found.
  console.log(student);
  if (!student) {
    next(new AppError("No student found with the provided id", 404));
    await client.close();
    return;
  }

  // Check if the mentor is already handling the provided student. If so send a bad request response.

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

  // Check for if the student has a mentor.

  if (!student.mentorId) {
    // if the student doesn't have a mentor add the mentor id to the student.
    student = await studentsCollection.findOneAndUpdate(
      { _id: student._id },
      { $set: { mentorId: mentor._id } },
      { returnDocument: "after" }
    );

    // Also add the student to the studentIds array of the mentor.
    mentor = await mentorsCollection.findOneAndUpdate(
      { _id: mentor._id },
      { $push: { studentIds: student._id } },
      { returnDocument: "after" }
    );
  } else {
    // If the student is already handled by a mentor. Remove the student from the student's previous mentor
    await mentorsCollection.findOneAndUpdate(
      { _id: student.mentorId },
      { $pull: { studentIds: student._id } }
    );

    // Add the provided mentor to the student and add the student's previous mentor in an array.
    student = await studentsCollection.findOneAndUpdate(
      { _id: student._id },
      {
        $push: { previousMentors: student.mentorId },
        $set: { mentorId: mentor._id },
      },
      { returnDocument: "after" }
    );
  }

  // Sending the response for a successful updation.

  res.status(200).json({
    status: "success",
    data: {
      mentor,
      student,
    },
  });
});

// HANDLER FUNCTION TO GET ALL THE PREVIOUS MENTORS OF A STUDENT.

exports.getPrevMentors = catchAsync(async (req, res, next) => {
  // Connecting the database and selcting the mentor and student collection.

  await client.connect();
  const database = client.db("guvi_mentor");
  const mentorsCollection = database.collection("mentors");
  const studentsCollection = database.collection("students");

  let student;

  // CHECK IF THE PROVIDED STUDENT ID IS A VALID MONGODB ID
  // IF SO THEN FIND THE STUDENT IN THE STUDENTS COLLECTION

  if (ObjectId.isValid(req.params.studentId)) {
    student = await studentsCollection.findOne({
      _id: new ObjectId(req.params.studentId),
    });
  }

  // IF THERE IS NO STUDENT WITH THE ID OR THE ID IS NOT A VALID MONGODB ID
  // THEN SEND NOT FOUNS=D ERROR RESPONSE.

  if (!student) {
    await client.close();
    return next(new AppError("No student found with the id", 404));
  }

  // INITIALIZE PREVIOUS MENTORS ARRAY.

  let previousMentors = [];

  // CHECK IF THE STUDENT HAVE ANY PREVIOUS MENTORS.

  if (student.previousMentors) {
    // LOOP THROUGH THE previousMentors ARRAY
    for (let mentorId of student.previousMentors) {
      // FIND THE MENTOR CORRESPONDING TO THE IDS OF THE PREVIOUS MENTORS
      const mentor = await mentorsCollection.findOne(
        { _id: mentorId },
        { projection: { name: 1, email: 1 } }
      );

      // IF THERE IS A MENTOR WITH THE ID ADD THE MENTOR TO previousMentors ARRAY.

      if (mentor) {
        previousMentors.push(mentor);
      }
    }
  }

  // SEND SUCCESS RESPONSE WITH THE STUDENT NAME AND PREVIOUS MENTORS DATA.

  res.status(200).json({
    status: "success",
    data: {
      studentName: student.name,
      noOfPrevMentor: previousMentors.length,
      previousMentors,
    },
  });
});
