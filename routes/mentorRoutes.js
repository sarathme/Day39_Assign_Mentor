const express = require("express");

const mentorController = require("./../controllers/mentorController");

const router = express.Router();

router
  .route("/")
  .post(mentorController.createMentor)
  .get(mentorController.getAllMentors);
router
  .route("/:mentorId/students/:studentId")
  .patch(mentorController.addStudent);

router.route("/:mentorId/students").get(mentorController.getStudentsOfMentor);

module.exports = router;
