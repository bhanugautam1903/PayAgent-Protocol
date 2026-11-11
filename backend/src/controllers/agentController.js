const { db } = require("../config/firebase");

const registerAgent = async (req, res) => {
  try {
    const { name, description, capabilities = [] } = req.body;

    if (
      typeof name !== "string" ||
      typeof description !== "string" ||
      !Array.isArray(capabilities)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid agent name, description and capabilities are required",
      });
    }

    const agentName = name.trim();
    const agentDescription = description.trim();
    const agentCapabilities = capabilities
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!agentName || !agentDescription) {
      return res.status(400).json({
        success: false,
        message: "Agent name and description cannot be empty",
      });
    }

    if (agentCapabilities.length !== capabilities.length) {
      return res.status(400).json({
        success: false,
        message: "Each capability must be a non-empty string",
      });
    }

    const agentData = {
      name: agentName,
      description: agentDescription,
      capabilities: [...new Set(agentCapabilities)],
      status: "active",
      createdAt: new Date(),
    };

    const agentRef = await db.collection("agents").add(agentData);

    return res.status(201).json({
      success: true,
      message: "Agent registered successfully",
      agentId: agentRef.id,
      agent: agentData,
    });
  } catch (error) {
    console.error("Agent registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register agent",
    });
  }
};

const getAllAgents = async (req, res) => {
  try {
    const snapshot = await db.collection("agents").get();

    const agents = snapshot.docs.map((doc) => ({
      agentId: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      count: agents.length,
      agents,
    });
  } catch (error) {
    console.error("Fetch agents error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agents",
    });
  }
};

module.exports = { registerAgent, getAllAgents };
