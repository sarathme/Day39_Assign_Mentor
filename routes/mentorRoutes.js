const express = require("express");

const mentorController = require("./../controllers/mentorController");

const router = express.Router();

router.route("/").post(mentorController.createMentor);

module.exports = router;
