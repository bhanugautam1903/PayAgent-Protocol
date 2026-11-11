const express = require("express");
const router = express.Router();

const {
  setAgentPermissions,
} = require("../controllers/permissionController");

const {
  verifyAgentPermission,
} = require("../middleware/verifyAgentPermission");

router.post("/set", setAgentPermissions);

router.post(
  "/verify-research",
  verifyAgentPermission("research", 0),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Agent permission verified successfully",
      agentId: req.agent.id,
      agentName: req.agent.name,
      capability: "research",
      status: "authorized",
    });
  }
);

router.post(
  "/verify-payment",
  verifyAgentPermission("payment", 0),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Payment permission verified successfully",
      agentId: req.agent.id,
      agentName: req.agent.name,
      capability: "payment",
      status: "authorized",
    });
  }
);

module.exports = router;

