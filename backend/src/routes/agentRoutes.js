const express = require("express");
const router = express.Router();

const {
  registerAgent,
  getAllAgents,
} = require("../controllers/agentController");

router.post("/register", registerAgent);
router.get("/", getAllAgents);

module.exports = router;