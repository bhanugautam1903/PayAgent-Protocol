require("dotenv").config();

const {
  createPayPalOrder,
} = require("./src/services/paypalService");

const testPayPal = async () => {
  try {
    console.log("Creating PayPal Sandbox order...");

    const order = await createPayPalOrder("1.00", "USD");

    console.log("PayPal order created successfully!");
    console.log("Order ID:", order.id);
    console.log("Order Status:", order.status);

    const approvalLink = order.links?.find(
      (link) => link.rel === "approve"
    )?.href;

    console.log("Approval Link:", approvalLink);
  } catch (error) {
    console.error("Order creation failed:", error.message);
  }
};

testPayPal();
