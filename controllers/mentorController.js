const { MongoClient, ObjectId } = require("mongodb");
const { catchAsync } = require("../utils/catchAsync");
const AppError = require("./../utils/appError");

// CONNECTING TO THE DATABASE

const url = process.env.DB_CONNECTION.replace(
  "<PASSWORD>",
  process.env.DB_PASSWORD
);
const client = new MongoClient(url);

// HANDLER FUNCTION FOR GETTING ALL MENTORS.

exports.getAllMentors = catchAsync(async (req, res, next) => {
  // CONNECTING THE DATABASE AND GETTING ALL THE MENTORS FROM THE COLLECTION.

  await client.connect();
  const database = client.db("guvi_mentor");
  const mentors = await database.collection("mentors").find({}).toArray();
  await client.close();

  // SENDING A SUCCESS RESPONSE WITH THE MENTORS DATA.

  res.status(200).json({
    status: "success",
    data: {
      mentors,
    },
  });
});

// HANDLER FOR CREATING A NEW MENTOR.

exports.createMentor = catchAsync(async (req, res, next) => {
  // CONNECTING THE DATABASE AND SELECTING THE MENTORS COLLECTION.
  await client.connect();
  const database = client.db("guvi_mentor");
  const mentors = database.collection("mentors");

  // CHECK IF THERE IS ALREADY A MENTOR WITH THE PROVIDED EMAIL IN THE COLLECTION.

  let mentor = await mentors.findOne({
    email: { $eq: req.body.email },
  });

  // IF THERE IS ALREADY A MENTOR WITH THE EMAIL SEND A ERROR RESPONSE THROUGH THE GLOBAL ERROR HANDLER.

  if (mentor) {
    next(new AppError(`Email: ${req.body.email} already exists`, 400));
    await client.close();
    return;
  }

  // IF THERE IS NO MENTOR THEN ADD THE NEW MENTOR WITH THE PROVIDED DATA TO THE DATABASE.

  const created = await mentors.insertOne(req.body);
  mentor = await mentors.findOne({ _id: created.insertedId });
  await client.close();

  // SENDING A CREATED RESPONSE WITH THE MENTOR DATA.

  res.status(201).json({
    status: "success",
    message: "Mentor created successfully",
    data: {
      mentor,
    },
  });
});

// HANDLER FUNCTION FOR ADDING ONE STUDENT TO A MENTOR.

exports.addStudent = catchAsync(async (req, res, next) => {
  // CONNECTING THE DATABASE CLIENT AND SELECTING sTUDENTS AND MENTORS COLLECTIONS.

  await client.connect();
  const database = client.db("guvi_mentor");
  const mentors = database.collection("mentors");
  const students = database.collection("students");

  let student;
  let mentor;

  // CHECK IF THE PROVIDED OBJECTID IS A VALID MONGODB ID IF VALID FIND THE STUDENT WITH THE ID.

  if (ObjectId.isValid(req.params.studentId)) {
    student = await students.findOne({
      _id: new ObjectId(req.params.studentId),
    });
  }

  // IF NO STUDENT FOUND WITH THE ID OR A INVALID MONGODB ID THEN SEND NOT FOUND ERROR RESPONSE.

  if (!student) {
    next(new AppError("No student found with the provided id", 404));
    await client.close();
    return;
  }

  // CHECK IF THE STUDENT ALREADY HAVE A MENTOR IF SO SEND BAD REQUEST ERROR RESPONSE.

  if (student.mentorId) {
    next(
      new AppError(
        "The provided student is already assigned with a mentor. Try updating the mentor on behalf of the student",
        400
      )
    );
    await client.close();
    return;
  }

  // IF ABOVE ALL ARE RESOLVED AND THE PROVIDED MENTOR ID IS A VALID MONGODB ID
  // THEN PUSH THE STUDENT ID TO THE MENTOR studentIds ARRAY FIELD.

  if (ObjectId.isValid(req.params.mentorId)) {
    mentor = await mentors.findOneAndUpdate(
      {
        _id: new ObjectId(req.params.mentorId),
      },
      { $push: { studentIds: new ObjectId(req.params.studentId) } },
      { returnDocument: "after" }
    );
  }

  // IF NO MENTOR FOUND WITH THE PROVIDED ID OR THE PROVAIDED ID IS A INVALID MONGODB ID.
  // THEN SEND A NOT FOUND ERROR RESPONSE.

  if (!mentor) {
    next(new AppError("No mentor found with the provided id", 404));
    await client.close();
    return;
  }

  // ALSO UPDATE THE PROVIDED STUDENT WITH THE MENTOR ID.

  await students.findOneAndUpdate(
    { _id: new ObjectId(req.params.studentId) },
    { $set: { mentorId: new ObjectId(req.params.mentorId) } }
  );

  // SEND A SUCCESS RESPONSE WITH THE ADDED STUDENT ID TO THE ARRAY.

  res.status(200).json({
    status: "success",
    data: {
      mentor,
    },
  });
});

// HANDLER FUNCTION TO GET ALL THE STUDENTS OF A MENTOR.

exports.getStudentsOfMentor = catchAsync(async (req, res, next) => {
  // CONNECTING THE DATABASE CLIENT TO THE DATABASE.

  await client.connect();
  const database = client.db("guvi_mentor");

  let mentor;

  // CHECK IF THE PROVIDED MENTOR ID IS A VALID MENTOR ID.
  // IF VALID FIND THE MENTOR WITH THE ID IN THE DATABASE.

  if (ObjectId.isValid(req.params.mentorId)) {
    mentor = await database
      .collection("mentors")
      .findOne({ _id: new ObjectId(req.params.mentorId) });
  }

  // IF NO MENTOR IS FOUND WITH THE ID OR THE PROVIDED ID IS AN INVALID MOGODB ID
  // THEN SEND AN NOT FOUND ERROR RESPONSE.

  if (!mentor) {
    next(new AppError("No mentor found with the provided id", 404));
    await client.close();
    return;
  }

  // LOOP THROUGH THE MENTOR'S studentIds ARRAY AND GET THE STUDENT DATA.

  let students = [];
  for (const studentId of mentor.studentIds) {
    const student = await database
      .collection("students")
      .findOne({ _id: studentId });
    if (student) {
      students.push(student);
    }
  }

  await client.close();

  // SEND SUCCESS RESPONSE WITH THE MENTOR NAME AND HIS/HER STUDENTS DATA.

  res.status(200).json({
    status: "success",
    data: {
      mentorName: mentor.name,
      totalStudents: students.length,
      students,
    },
  });
});

// HANDLER FUNCTION TO ADD MULTIPLE STUDENTS TO A MENTOR.

exports.addMultipleStudents = catchAsync(async (req, res, next) => {
  // CONNECT THE DATABASE CLIENT TO THE DATABASE AND SELECT THE MENTORS AND STUDENTS COLLECTION.

  await client.connect();
  const database = client.db("guvi_mentor");
  const studentCollection = database.collection("students");
  const mentorCollection = database.collection("mentors");

  let mentor;

  // CHECK IF THE PROVIDED MONGODB ID IS VALID
  // IF VALID FIND THE MENTOR WITH THE PROVIDED MENTOR ID.

  if (ObjectId.isValid(req.params.mentorId)) {
    mentor = await mentorCollection.findOne({
      _id: new ObjectId(req.params.mentorId),
    });
  }

  // IF NO MENTOR IS FOUND OR PROVIDED MENTOR ID IS INVALID
  // SEND A NOT FOUND ERROR RESPONSE.

  if (!mentor) {
    next(new AppError("No mentor found for the provided ID", 404));
    client.close();
    return;
  }

  // INITIALIZE AN EMPTY ARRAY FOR TO BE ADDED STUDENTS.
  let studentsAdded = [];

  // LOOP THROUGH THE RECEIVED STUDENTIDS IN THE REQUEST BODY.

  for (let studentId of req.body.studentIds) {
    // CHECK EACH ID IS A VALID MONGODB ID
    // AND IF THE ID IS NOT ALREADY PRESENT IN THE PROVIDED MENTOR.

    if (
      ObjectId.isValid(studentId) &&
      (!mentor.studentIds ||
        !mentor.studentIds.some((id) => id.equals(studentId)))
    ) {
      // CONVERT THE RECEIVED MONGODB ID AND CONVERT TO MONGPDB ID.

      const studentObjectId = new ObjectId(studentId);

      // FINDING THE STUDENT BY THE ID IN THE STUDENT COLLECTION
      // AND UPDATING THE STUDENT'S MENTOR ID TO THE PROVIDED MENTOR ID
      // AND EXCLUDING STUDENTS WHO HAVE A MENTOR ALREADY.

      const student = await studentCollection.findOneAndUpdate(
        {
          _id: studentObjectId,
          $or: [{ mentorId: { $exists: false } }, { mentorId: "" }],
        },
        { $set: { mentorId: mentor._id } },
        { returnDocument: "after" }
      );

      if (student) {
        // IF STUDENT IS FOUND WITH THE ID ADD TO THE studentsAdded Array.

        studentsAdded.push(student);

        // UPDATING THE PROVIDED MENTOR'S studentIds ARRAY WITH THE NEWLY ADDED STUDENT.

        mentor = await mentorCollection.findOneAndUpdate(
          { _id: mentor._id },
          { $push: { studentIds: student._id } },
          { returnDocument: "after" }
        );
      }
    }
  }

  client.close();

  // SENDING A SUCCESS RESPONSE WITH THE MENTOR AND NEWLY ADDED STUDENTS DETAILS.

  res.status(200).json({
    status: "success",
    data: {
      mentor,
      studentsAdded,
    },
  });
});
