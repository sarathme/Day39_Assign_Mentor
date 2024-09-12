# Mentor Assign for Students API

POSTMAN DOCUMENTATION:
[Click Here](https://documenter.getpostman.com/view/16657839/2sAXqndj4k)

## Table of Contents

1. [Utlity Functions](#utility-functions)
2. [Global Error handling Middleware](#global-error-handling-middleware)
3. [Route Definitions](#route-definitions)
   1. [Mentor Route Definitions](#mentors-route-definitions)
   2. [Student Route Definitions](#students-route-definitions)
4. [Handler Functions For Mentors Route](#handler-functions-for-mentors-route)
5. [handler Functions For Student Routes](#handler-funtions-for-student-routes)

## Utility Functions

### Global error catching function for async functions

```js
// UTILITY FUNCTION TO ACT AS COMMON ERROR CATCHING PLACE FOR THE ASYNC FUNCTIONS.

exports.catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
```

#### AppError class to define custom error object

```js
// CUSTOM APPERROR CLASS EXTENDING THE ERROR CLASS FOR CUSTOM ERROR RESPONSES.

class AppError extends Error {
  constructor(message, statusCode) {
    // CALLING THE Error class.

    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

    // THIS isOperational field is used to indicate the errors which are handled by us.
    // Other errors donot have this field so we can distinguish the errors.

    this.isOperational = true;
  }
}

// Exporting the AppError class.

module.exports = AppError;
```

## Global Error handling Middleware

```js
// Global error handling middleware for entire express app.

module.exports = (err, req, res, next) => {
  // This if block is to send generic error for errors outside the express app like mongodb errors.
  if (!err.isOperational) {
    return res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }

  // Setting the error status according to the status code
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Sending the error response.
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });
};
```

## Route Definitions

### Mentors Route definitions

```js
const express = require("express");

const mentorController = require("./../controllers/mentorController");

// CREATING AN INSTANCE OF EXPRESS ROUTER OBJECT.

const router = express.Router();

// DEFINING VARIOUS ROUTES.

router
  .route("/")
  .post(mentorController.createMentor)
  .get(mentorController.getAllMentors);
router
  .route("/:mentorId/students/:studentId")
  .patch(mentorController.addStudent);

router
  .route("/:mentorId/insert-multiple-students")
  .patch(mentorController.addMultipleStudents);

router.route("/:mentorId/students").get(mentorController.getStudentsOfMentor);

module.exports = router;
```

### Students route definitions

```js
const express = require("express");

const studentController = require("./../controllers/studentController");

const router = express.Router();

router.route("/").post(studentController.createStudent);
router
  .route("/:studentId/previous-mentors")
  .get(studentController.getPrevMentors);
router
  .route("/:studentId/mentors/:mentorId")
  .patch(studentController.changeMentorOfStudent);

module.exports = router;
```

## Handler Functions For Mentors Route

### Get all mentors in the mentors collection

```js
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
```

### Creating A New Mentor

```js
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
```

### Adding Single Student To A Mentor

```js
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
  console.log(student);
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
```

### Get All Students of A Particular Mentor

```js
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
```

### Add Multiple Students To A Mentor

```js
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
      !mentor.studentIds.some((id) => id.equals(studentId))
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
```

## Handler Funtions For Student Routes

### Creating New Student

```js
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
```

### Adding Or Modifying Mentor For A Student

```js
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

  if (!mentor) {
    next(new AppError("No mentor found with the provided id", 404));
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
    await studentsCollection.findOneAndUpdate(
      { _id: student._id },
      { $set: { mentorId: mentor._id } }
    );

    // Also add the student to the studentIds array of the mentor.
    await mentorsCollection.findOneAndUpdate(
      { _id: mentor._id },
      { $push: { studentIds: student._id } }
    );
  } else {
    // If the student is already handled by a mentor. Remove the student from the student's previous mentor
    await mentorsCollection.findOneAndUpdate(
      { _id: student.mentorId },
      { $pull: { studentIds: student._id } }
    );

    // Add the provided mentor to the student and add the student's previous mentor in an array.
    await studentsCollection.findOneAndUpdate(
      { _id: student._id },
      {
        $push: { previousMentors: student.mentorId },
        $set: { mentorId: mentor._id },
      }
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
```

### Getting All Previous Mentors Of A Student

```js
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
```
