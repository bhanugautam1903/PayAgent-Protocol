const express = require("express");
const router = express.Router();

const {
  createTask,
  getTasks,
  confirmPayPalApproval,
  acceptTask,
  executeTask,
} = require("../controllers/taskController");

const { reviewTask } = require("../controllers/reviewController");

const {
  uploadCsv,
  analyzeSalesCsvController,
} = require("../controllers/salesAnalysisController");

router.post("/create", createTask);
router.get("/", getTasks);
router.post("/confirm-payment", confirmPayPalApproval);
router.post("/accept", acceptTask);
router.post("/execute", executeTask);
router.post("/review", reviewTask);

router.post(
  "/analyze-sales",
  uploadCsv,
  analyzeSalesCsvController
);

module.exports = router;
