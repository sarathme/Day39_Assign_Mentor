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
