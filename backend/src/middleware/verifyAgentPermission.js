const { db } = require("../config/firebase");

const verifyAgentPermission = (requiredCapability, requestedAmount = 0) => {
  return async (req, res, next) => {
    try {
      const { agentId } = req.body;

      if (!agentId || typeof agentId !== "string" || !agentId.trim()) {
        return res.status(400).json({
          success: false,
          message: "A valid agent ID is required",
        });
      }

      if (
        typeof requiredCapability !== "string" ||
        !requiredCapability.trim()
      ) {
        return res.status(500).json({
          success: false,
          message: "Required capability is not configured",
        });
      }

      const amount = Number(
        typeof requestedAmount === "function"
          ? requestedAmount(req)
          : requestedAmount
      );

      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid requested amount",
        });
      }

      const agentRef = db.collection("agents").doc(agentId.trim());
      const snapshot = await agentRef.get();

      if (!snapshot.exists) {
        return res.status(404).json({
          success: false,
          message: "Agent not found",
        });
      }

      const agent = snapshot.data();
      const permissions = agent.permissions;

      if (
        !permissions ||
        !Array.isArray(permissions.allowedCapabilities) ||
        typeof permissions.spendingLimit !== "number" ||
        !Number.isFinite(permissions.spendingLimit)
      ) {
        return res.status(403).json({
          success: false,
          message: "Agent permissions are missing or invalid",
        });
      }

      if (agent.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Agent is not active",
        });
      }

      if (!permissions.allowedCapabilities.includes(requiredCapability)) {
        return res.status(403).json({
          success: false,
          message: "Agent does not have permission for this capability",
          requiredCapability,
          allowedCapabilities: permissions.allowedCapabilities,
        });
      }

      if (amount > permissions.spendingLimit) {
        return res.status(403).json({
          success: false,
          message: "Requested amount exceeds the agent spending limit",
          spendingLimit: permissions.spendingLimit,
          requestedAmount: amount,
        });
      }

      req.agent = {
        id: snapshot.id,
        ...agent,
      };

      req.requestedAmount = amount;

      return next();
    } catch (error) {
      console.error("Permission verification error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to verify agent permissions",
      });
    }
  };
};

module.exports = { verifyAgentPermission };
