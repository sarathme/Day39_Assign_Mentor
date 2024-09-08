const express = require("express");

const studentController = require("./../controllers/studentController");

const router = express.Router();

router.route("/").post(studentController.createStudent);
router
  .route("/:studentId/mentors/:mentorId")
  .patch(studentController.changeMentorOfStudent);

module.exports = router;
