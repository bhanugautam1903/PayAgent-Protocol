const { db } = require("../config/firebase");

const setAgentPermissions = async (req, res) => {
  try {
    const { agentId, spendingLimit, allowedCapabilities } = req.body;

    if (
      !agentId ||
      spendingLimit === undefined ||
      !Array.isArray(allowedCapabilities)
    ) {
      return res.status(400).json({
        success: false,
        message: "Agent ID, spending limit and allowed capabilities are required",
      });
    }

    const limit = Number(spendingLimit);

    if (!Number.isFinite(limit) || limit <= 0) {
      return res.status(400).json({
        success: false,
        message: "Spending limit must be a positive number",
      });
    }

    const snapshot = await db.collection("agents").get();

    if (snapshot.empty) {
      return res.status(404).json({
        success: false,
        message: "No agents registered",
      });
    }

    const requestedId = String(agentId).trim();

    const exactMatch = snapshot.docs.find(
      (doc) => doc.id === requestedId
    );

    if (!exactMatch) {
      return res.status(404).json({
        success: false,
        message: "Agent ID does not match",
        requested: {
          value: JSON.stringify(requestedId),
          length: requestedId.length,
          characters: [...requestedId].map((char) => ({
            character: char,
            code: char.charCodeAt(0),
          })),
        },
        available: snapshot.docs.map((doc) => ({
          id: JSON.stringify(doc.id),
          length: doc.id.length,
          characters: [...doc.id].map((char) => ({
            character: char,
            code: char.charCodeAt(0),
          })),
        })),
      });
    }

    const permissionData = {
      spendingLimit: limit,
      allowedCapabilities,
      updatedAt: new Date(),
    };

    await exactMatch.ref.update({
      permissions: permissionData,
    });

    return res.status(200).json({
      success: true,
      message: "Agent permissions updated successfully",
      agentId: exactMatch.id,
      permissions: permissionData,
    });
  } catch (error) {
    console.error("Permission update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update agent permissions",
      error: error.message,
    });
  }
};

module.exports = { setAgentPermissions };
