const crypto = require("crypto");
const { db } = require("../config/firebase");
const {
  getPayPalOrderDetails,
  capturePayPalOrder,
} = require("../services/paypalService");

const reviewTask = async (req, res) => {
  let taskRef;
  let captureRequestId;

  try {
    const { taskId, requesterAgentId, decision, feedback } = req.body;

    if (
      typeof taskId !== "string" ||
      typeof requesterAgentId !== "string" ||
      !taskId.trim() ||
      !requesterAgentId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Task ID and requester agent ID are required",
      });
    }

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be approved or rejected",
      });
    }

    if (
      feedback !== undefined &&
      (typeof feedback !== "string" || feedback.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Feedback must be text and cannot exceed 1000 characters",
      });
    }

    const cleanTaskId = taskId.trim();
    const cleanRequesterId = requesterAgentId.trim();
    const cleanFeedback = feedback ? feedback.trim() : "";

    taskRef = db.collection("tasks").doc(cleanTaskId);

    const requesterRef = db.collection("agents").doc(cleanRequesterId);
    const requesterDoc = await requesterRef.get();

    if (!requesterDoc.exists || requesterDoc.data().status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Requester agent does not exist or is not active",
      });
    }

    const requestHash = crypto
      .createHash("sha256")
      .update(cleanTaskId)
      .digest("hex")
      .slice(0, 32);

    captureRequestId = `pa-${requestHash}`;

    // Handle rejection without capturing payment.
    if (decision === "rejected") {
      const rejection = await db.runTransaction(async (transaction) => {
        const taskDoc = await transaction.get(taskRef);

        if (!taskDoc.exists) {
          return { error: "TASK_NOT_FOUND" };
        }

        const task = taskDoc.data();

        if (task.requesterAgentId !== cleanRequesterId) {
          return { error: "NOT_REQUESTER" };
        }

        if (task.paymentStatus === "captured") {
          return { error: "PAYMENT_ALREADY_CAPTURED" };
        }

        if (task.paymentCaptureStatus === "processing") {
          return { error: "CAPTURE_IN_PROGRESS" };
        }

        if (task.status !== "under_review") {
          return { error: "TASK_NOT_UNDER_REVIEW" };
        }

        transaction.update(taskRef, {
          status: "rejected",
          paymentStatus: "not_captured",
          reviewedByAgentId: cleanRequesterId,
          reviewFeedback: cleanFeedback,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        });

        return { success: true };
      });

      if (rejection.error) {
        const errors = {
          TASK_NOT_FOUND: [404, "Task not found"],
          NOT_REQUESTER: [
            403,
            "Only the original requester can review this task",
          ],
          PAYMENT_ALREADY_CAPTURED: [
            409,
            "Payment has already been captured",
          ],
          CAPTURE_IN_PROGRESS: [
            409,
            "Payment capture is already in progress",
          ],
          TASK_NOT_UNDER_REVIEW: [
            409,
            "Task is not waiting for review",
          ],
        };

        const [statusCode, message] = errors[rejection.error];

        return res.status(statusCode).json({
          success: false,
          message,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Task rejected successfully. Payment was not captured.",
        taskId: cleanTaskId,
        status: "rejected",
        paymentStatus: "not_captured",
        decision,
      });
    }

    // Lock the task before attempting PayPal capture.
    const lock = await db.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        return { error: "TASK_NOT_FOUND" };
      }

      const task = taskDoc.data();

      if (task.requesterAgentId !== cleanRequesterId) {
        return { error: "NOT_REQUESTER" };
      }

      if (task.paymentStatus === "captured") {
        return {
          alreadyCaptured: true,
          taskId: taskDoc.id,
          captureId: task.paypalCaptureId,
          capturedAmount: task.capturedAmount,
          capturedCurrency: task.capturedCurrency,
        };
      }

      if (task.paymentCaptureStatus === "processing") {
        return { error: "CAPTURE_IN_PROGRESS" };
      }

      // "approved" is also allowed for retrying older failed records.
      if (
        task.status !== "under_review" &&
        task.status !== "approved"
      ) {
        return { error: "TASK_NOT_UNDER_REVIEW" };
      }

      const stableRequestId =
        task.paymentCaptureRequestId || captureRequestId;

      transaction.update(taskRef, {
        // Keep the task reviewable until PayPal confirms capture.
        status: "under_review",
        paymentCaptureStatus: "processing",
        paymentCaptureRequestId: stableRequestId,
        reviewedByAgentId: cleanRequesterId,
        reviewFeedback: cleanFeedback,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        locked: true,
        requestId: stableRequestId,
        paypalOrderId: task.paypalOrderId,
        budget: task.budget,
        currency: task.currency || "USD",
      };
    });

    if (lock.error) {
      const errors = {
        TASK_NOT_FOUND: [404, "Task not found"],
        NOT_REQUESTER: [
          403,
          "Only the original requester can review this task",
        ],
        CAPTURE_IN_PROGRESS: [
          409,
          "Payment capture is already in progress",
        ],
        TASK_NOT_UNDER_REVIEW: [
          409,
          "Task is not waiting for approval",
        ],
      };

      const [statusCode, message] = errors[lock.error];

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }

    if (lock.alreadyCaptured) {
      return res.status(200).json({
        success: true,
        message: "Task is already approved and payment is captured",
        taskId: lock.taskId,
        status: "approved",
        paymentStatus: "captured",
        captureId: lock.captureId,
        capturedAmount: lock.capturedAmount,
        capturedCurrency: lock.capturedCurrency,
        decision,
      });
    }

    captureRequestId = lock.requestId;

    if (!lock.paypalOrderId) {
      throw new Error("PayPal order ID is missing from this task");
    }

    const expectedAmount = Number(lock.budget).toFixed(2);
    const expectedCurrency = lock.currency;

    const orderDetails = await getPayPalOrderDetails(lock.paypalOrderId);

    const orderAmount =
      orderDetails.purchase_units?.[0]?.amount?.value;

    const orderCurrency =
      orderDetails.purchase_units?.[0]?.amount?.currency_code;

    if (
      !Number.isFinite(Number(orderAmount)) ||
      Number(orderAmount).toFixed(2) !== expectedAmount ||
      orderCurrency !== expectedCurrency
    ) {
      throw new Error(
        "PayPal order amount or currency does not match the task"
      );
    }

    let captureDetails;

    if (orderDetails.status === "COMPLETED") {
      // Handles cases where PayPal captured successfully but
      // the previous request did not save the result in Firestore.
      captureDetails =
        orderDetails.purchase_units?.[0]?.payments?.captures?.[0];
    } else if (orderDetails.status === "APPROVED") {
      const captureResponse = await capturePayPalOrder(
        lock.paypalOrderId,
        captureRequestId
      );

      if (captureResponse.status !== "COMPLETED") {
        throw new Error("PayPal has not confirmed payment capture");
      }

      captureDetails =
        captureResponse.purchase_units?.[0]?.payments?.captures?.[0];
    } else {
      throw new Error(
        `PayPal order is not approved for capture. Current status: ${orderDetails.status}`
      );
    }

    if (!captureDetails || captureDetails.status !== "COMPLETED") {
      throw new Error("PayPal capture details could not be verified");
    }

    if (
      !Number.isFinite(Number(captureDetails.amount?.value)) ||
      Number(captureDetails.amount.value).toFixed(2) !== expectedAmount ||
      captureDetails.amount.currency_code !== expectedCurrency
    ) {
      throw new Error(
        "Captured amount or currency does not match the task"
      );
    }

    // Save successful payment and approve the task together.
    const saved = await db.runTransaction(async (transaction) => {
      const latestDoc = await transaction.get(taskRef);

      if (!latestDoc.exists) {
        return { error: "TASK_NOT_FOUND" };
      }

      const latestTask = latestDoc.data();

      if (latestTask.paymentStatus === "captured") {
        return { alreadyCaptured: true };
      }

      if (
        latestTask.paymentCaptureRequestId !== captureRequestId ||
        latestTask.paymentCaptureStatus !== "processing"
      ) {
        return { error: "CAPTURE_LOCK_CHANGED" };
      }

      transaction.update(taskRef, {
        status: "approved",
        paymentStatus: "captured",
        paymentCaptureStatus: "completed",
        paypalOrderStatus: "COMPLETED",
        paypalCaptureId: captureDetails.id,
        capturedAmount: captureDetails.amount.value,
        capturedCurrency: captureDetails.amount.currency_code,
        capturedAt: new Date(),
        reviewedByAgentId: cleanRequesterId,
        reviewFeedback: cleanFeedback,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true };
    });

    if (saved.error) {
      throw new Error(saved.error);
    }

    return res.status(200).json({
      success: true,
      message: saved.alreadyCaptured
        ? "Payment was already captured successfully"
        : "Task approved and PayPal payment captured successfully",
      taskId: cleanTaskId,
      status: "approved",
      paymentStatus: "captured",
      paypalOrderStatus: "COMPLETED",
      captureId: captureDetails.id,
      capturedAmount: captureDetails.amount.value,
      capturedCurrency: captureDetails.amount.currency_code,
      decision,
    });
  } catch (error) {
    console.error("Task review and payment capture error:", error);

    // Release the capture lock so the requester can retry.
    // Keep the task under_review rather than hiding its review controls.
    if (taskRef && captureRequestId) {
      try {
        await db.runTransaction(async (transaction) => {
          const taskDoc = await transaction.get(taskRef);

          if (!taskDoc.exists) return;

          const task = taskDoc.data();

          if (
            task.paymentCaptureRequestId === captureRequestId &&
            task.paymentCaptureStatus === "processing"
          ) {
            transaction.update(taskRef, {
              status: "under_review",
              paymentCaptureStatus: "failed",
              updatedAt: new Date(),
            });
          }
        });
      } catch (lockError) {
        console.error("Failed to update capture lock:", lockError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Task review or PayPal payment capture failed",
      error: error.message,
    });
  }
};

module.exports = { reviewTask };
