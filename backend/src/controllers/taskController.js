const { db } = require("../config/firebase");
const { verifyTaskResult } = require("../services/geminiService");
const {
  createPayPalOrder,
  getPayPalOrderDetails,
} = require("../services/paypalService");

const normalizeCapability = (value) =>
  typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s_]+/g, "-")
    : "";

const createTask = async (req, res) => {
  try {
    const {
      requesterAgentId,
      assignedAgentId,
      title,
      description,
      requiredCapability,
      budget,
    } = req.body;

    if (
      typeof requesterAgentId !== "string" ||
      typeof assignedAgentId !== "string" ||
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof requiredCapability !== "string" ||
      budget === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "All task details are required",
      });
    }

    const requesterId = requesterAgentId.trim();
    const assignedId = assignedAgentId.trim();
    const taskTitle = title.trim();
    const taskDescription = description.trim();
    const capability = requiredCapability.trim();
    const normalizedCapability = normalizeCapability(capability);
    const taskBudget = Number(budget);

    if (
      !requesterId ||
      !assignedId ||
      !taskTitle ||
      !taskDescription ||
      !capability
    ) {
      return res.status(400).json({
        success: false,
        message: "Task details cannot be empty",
      });
    }

    if (requesterId === assignedId) {
      return res.status(400).json({
        success: false,
        message: "An agent cannot assign a task to itself",
      });
    }

    if (!Number.isFinite(taskBudget) || taskBudget <= 0) {
      return res.status(400).json({
        success: false,
        message: "Task budget must be a positive number",
      });
    }

    const requesterRef = db.collection("agents").doc(requesterId);
    const assignedRef = db.collection("agents").doc(assignedId);

    const [requesterDoc, assignedDoc] = await Promise.all([
      requesterRef.get(),
      assignedRef.get(),
    ]);

    if (!requesterDoc.exists || !assignedDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Requester or assigned agent not found",
      });
    }

    const requester = requesterDoc.data();
    const assigned = assignedDoc.data();

    if (requester.status !== "active" || assigned.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Both agents must be active",
      });
    }

    const requesterPermissions = requester.permissions;
    const assignedPermissions = assigned.permissions;

    if (
      !requesterPermissions ||
      !Number.isFinite(requesterPermissions.spendingLimit) ||
      requesterPermissions.spendingLimit <= 0
    ) {
      return res.status(403).json({
        success: false,
        message: "Requester spending permissions are not configured",
      });
    }

    const configuredCapabilities = Array.isArray(
      assignedPermissions?.allowedCapabilities
    )
      ? assignedPermissions.allowedCapabilities
          .map(normalizeCapability)
          .filter(Boolean)
      : [];

    if (!configuredCapabilities.includes(normalizedCapability)) {
      console.error("Agent capability permission check failed:", {
        assignedAgentId: assignedDoc.id,
        requestedCapability: capability,
        normalizedCapability,
        configuredCapabilities,
      });

      return res.status(403).json({
        success: false,
        message: `Assigned agent does not have permission for capability: ${capability}`,
        requestedCapability: capability,
        normalizedCapability,
        allowedCapabilities: configuredCapabilities,
      });
    }

    if (taskBudget > requesterPermissions.spendingLimit) {
      return res.status(403).json({
        success: false,
        message: "Task budget exceeds requester spending limit",
        spendingLimit: requesterPermissions.spendingLimit,
        requestedBudget: taskBudget,
      });
    }

    const paypalOrder = await createPayPalOrder(taskBudget, "USD");

    const approvalLink = paypalOrder.links?.find(
      (link) => link.rel === "approve"
    );

    if (!paypalOrder.id || !approvalLink) {
      throw new Error("PayPal order or approval link was not returned");
    }

    const taskData = {
      requesterAgentId: requesterDoc.id,
      assignedAgentId: assignedDoc.id,
      title: taskTitle,
      description: taskDescription,
      requiredCapability: normalizedCapability,
      budget: taskBudget,
      currency: "USD",
      paypalOrderId: paypalOrder.id,
      paypalOrderStatus: paypalOrder.status,
      status: "pending",
      paymentStatus: "pending_approval",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRef = await db.collection("tasks").add(taskData);

    return res.status(201).json({
      success: true,
      message: "Task created. Complete PayPal checkout to approve payment.",
      taskId: taskRef.id,
      paypalOrderId: paypalOrder.id,
      approvalUrl: approvalLink.href,
      task: taskData,
    });
  } catch (error) {
    console.error("Task creation error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create task",
    });
  }
};

const getTasks = async (req, res) => {
  try {
    const snapshot = await db
      .collection("tasks")
      .orderBy("createdAt", "desc")
      .get();

    const tasks = snapshot.docs.map((doc) => ({
      taskId: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error("Task retrieval error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve tasks",
    });
  }
};

const confirmPayPalApproval = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (typeof orderId !== "string" || !orderId.trim()) {
      return res.status(400).json({
        success: false,
        message: "PayPal order ID is required",
      });
    }

    const cleanOrderId = orderId.trim();

    const snapshot = await db
      .collection("tasks")
      .where("paypalOrderId", "==", cleanOrderId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        success: false,
        message: "No task found for this PayPal order",
      });
    }

    const taskDoc = snapshot.docs[0];
    const taskRef = taskDoc.ref;

    const paypalOrder = await getPayPalOrderDetails(cleanOrderId);

    if (paypalOrder.status !== "APPROVED") {
      return res.status(409).json({
        success: false,
        message: "PayPal order has not been approved",
        paypalOrderStatus: paypalOrder.status,
      });
    }

    const result = await db.runTransaction(async (transaction) => {
      const latestDoc = await transaction.get(taskRef);

      if (!latestDoc.exists) {
        return { error: "TASK_NOT_FOUND" };
      }

      const task = latestDoc.data();

      if (task.paypalOrderId !== cleanOrderId) {
        return { error: "ORDER_MISMATCH" };
      }

      if (task.status !== "pending") {
        return { error: "TASK_NOT_PENDING" };
      }

      transaction.update(taskRef, {
        paymentStatus: "approved",
        paypalOrderStatus: "APPROVED",
        paymentApprovedAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        taskId: latestDoc.id,
        paymentStatus: "approved",
        paypalOrderStatus: "APPROVED",
      };
    });

    if (result.error) {
      return res.status(409).json({
        success: false,
        message: "Task is no longer available for payment confirmation",
      });
    }

    return res.status(200).json({
      success: true,
      message: "PayPal approval verified successfully",
      ...result,
    });
  } catch (error) {
    console.error("PayPal approval confirmation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to confirm PayPal approval",
    });
  }
};

const acceptTask = async (req, res) => {
  try {
    const { taskId, agentId } = req.body;

    if (
      typeof taskId !== "string" ||
      typeof agentId !== "string" ||
      !taskId.trim() ||
      !agentId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Task ID and agent ID are required",
      });
    }

    const cleanTaskId = taskId.trim();
    const cleanAgentId = agentId.trim();

    const taskRef = db.collection("tasks").doc(cleanTaskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = taskDoc.data();

    if (task.assignedAgentId !== cleanAgentId) {
      return res.status(403).json({
        success: false,
        message: "This task is not assigned to this agent",
      });
    }

    if (task.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Task is not available for acceptance",
      });
    }

    if (!task.paypalOrderId) {
      return res.status(400).json({
        success: false,
        message: "PayPal order is missing for this task",
      });
    }

    const agentRef = db.collection("agents").doc(cleanAgentId);
    const agentDoc = await agentRef.get();

    if (!agentDoc.exists || agentDoc.data().status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Agent does not exist or is not active",
      });
    }

    const paypalOrder = await getPayPalOrderDetails(task.paypalOrderId);

    if (paypalOrder.status !== "APPROVED") {
      return res.status(409).json({
        success: false,
        message: "PayPal payment has not been approved yet",
        paypalOrderStatus: paypalOrder.status,
      });
    }

    const result = await db.runTransaction(async (transaction) => {
      const latestTaskDoc = await transaction.get(taskRef);

      if (!latestTaskDoc.exists) {
        return { error: "TASK_NOT_FOUND" };
      }

      const latestTask = latestTaskDoc.data();

      if (latestTask.assignedAgentId !== cleanAgentId) {
        return { error: "NOT_ASSIGNED_AGENT" };
      }

      if (latestTask.status !== "pending") {
        return { error: "TASK_NOT_PENDING" };
      }

      if (latestTask.paypalOrderId !== task.paypalOrderId) {
        return { error: "ORDER_MISMATCH" };
      }

      transaction.update(taskRef, {
        status: "accepted",
        paymentStatus: "approved",
        paypalOrderStatus: paypalOrder.status,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        taskId: latestTaskDoc.id,
        status: "accepted",
        paymentStatus: "approved",
        paypalOrderStatus: paypalOrder.status,
      };
    });

    if (result.error) {
      const errors = {
        TASK_NOT_FOUND: [404, "Task not found"],
        NOT_ASSIGNED_AGENT: [403, "This task is not assigned to this agent"],
        TASK_NOT_PENDING: [409, "Task is not available for acceptance"],
        ORDER_MISMATCH: [409, "PayPal order does not match this task"],
      };

      const [statusCode, message] = errors[result.error];

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "PayPal order verified and task accepted successfully",
      ...result,
    });
  } catch (error) {
    console.error("Task acceptance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to accept task",
    });
  }
};

const executeTask = async (req, res) => {
  try {
    const { taskId, agentId, result } = req.body;

    if (
      typeof taskId !== "string" ||
      typeof agentId !== "string" ||
      typeof result !== "string" ||
      !taskId.trim() ||
      !agentId.trim() ||
      !result.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Task ID, agent ID and execution result are required",
      });
    }

    if (result.trim().length > 10000) {
      return res.status(400).json({
        success: false,
        message: "Execution result cannot exceed 10,000 characters",
      });
    }

    const cleanTaskId = taskId.trim();
    const cleanAgentId = agentId.trim();
    const executionResult = result.trim();

    const taskRef = db.collection("tasks").doc(cleanTaskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = taskDoc.data();

    if (task.assignedAgentId !== cleanAgentId) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned agent can submit results",
      });
    }

    if (task.status !== "accepted") {
      return res.status(409).json({
        success: false,
        message: "Task must be accepted before execution",
      });
    }

    let aiVerification;
    let verificationAvailable = true;

    try {
      aiVerification = await verifyTaskResult(task, executionResult);

      const validVerdicts = ["approved", "rejected", "needs_review"];

      if (
        !aiVerification ||
        !validVerdicts.includes(aiVerification.verdict) ||
        !Number.isFinite(aiVerification.score) ||
        aiVerification.score < 0 ||
        aiVerification.score > 100 ||
        typeof aiVerification.reasoning !== "string" ||
        !Array.isArray(aiVerification.missingItems)
      ) {
        throw new Error("Gemini returned an invalid verification response");
      }
    } catch (aiError) {
      verificationAvailable = false;

      console.error("Gemini verification unavailable:", aiError.message);

      aiVerification = {
        verdict: "needs_review",
        score: 0,
        reasoning: "AI verification could not be completed. Manual review is required.",
        missingItems: ["AI verification unavailable"],
      };
    }

    const execution = await db.runTransaction(async (transaction) => {
      const latestTaskDoc = await transaction.get(taskRef);

      if (!latestTaskDoc.exists) {
        return { error: "TASK_NOT_FOUND" };
      }

      const latestTask = latestTaskDoc.data();

      if (latestTask.assignedAgentId !== cleanAgentId) {
        return { error: "NOT_ASSIGNED_AGENT" };
      }

      if (latestTask.status !== "accepted") {
        return { error: "TASK_NOT_ACCEPTED" };
      }

      transaction.update(taskRef, {
        status: "under_review",
        executionResult,
        aiVerification: {
          verdict: aiVerification.verdict,
          score: aiVerification.score,
          reasoning: aiVerification.reasoning,
          missingItems: aiVerification.missingItems,
          verificationAvailable,
          verifiedAt: new Date(),
        },
        submittedAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        taskId: latestTaskDoc.id,
        status: "under_review",
        paymentStatus: latestTask.paymentStatus,
        aiVerification: {
          ...aiVerification,
          verificationAvailable,
        },
      };
    });

    if (execution.error) {
      const errors = {
        TASK_NOT_FOUND: [404, "Task not found"],
        NOT_ASSIGNED_AGENT: [403, "Only the assigned agent can submit results"],
        TASK_NOT_ACCEPTED: [409, "Task must be accepted before execution"],
      };

      const [statusCode, message] = errors[execution.error];

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }

    return res.status(200).json({
      success: true,
      message: verificationAvailable
        ? "Task submitted and Gemini AI verification completed"
        : "Task submitted successfully. AI verification is unavailable; manual review is required.",
      ...execution,
    });
  } catch (error) {
    console.error("Task execution error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit task result",
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  confirmPayPalApproval,
  acceptTask,
  executeTask,
};