const express = require("express");
const router = express.Router();
const contactController = require("./contactController");
const { adminAuth } = require("../../shared/middlewares/auth");

router.get("/contactMessages", adminAuth, contactController.customerMessages);

module.exports = router;
