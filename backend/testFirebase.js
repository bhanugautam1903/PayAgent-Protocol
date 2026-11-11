const { db } = require("./src/config/firebase");

async function testFirebase() {
  try {
    await db.collection("system").doc("connection").set({
      project: "PayAgent Protocol",
      status: "connected",
      timestamp: new Date(),
    });

    console.log("Firestore connection successful!");
    process.exit(0);
  } catch (error) {
    console.error("Firestore connection failed:", error.message);
    process.exit(1);
  }
}

testFirebase();
