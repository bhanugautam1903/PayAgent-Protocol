const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const fs = require("fs");
const path = require("path");

const localServiceAccountPath = path.resolve(
  __dirname,
  "../../config/serviceAccountKey.json"
);

const getFirebaseCredential = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let serviceAccount;

    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT must contain valid JSON");
    }

    return cert(serviceAccount);
  }

  if (fs.existsSync(localServiceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(localServiceAccountPath, "utf8")
    );

    return cert(serviceAccount);
  }

  throw new Error(
    "Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT or provide the local service account file."
  );
};

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: getFirebaseCredential(),
    });

const db = getFirestore(app);

console.log("Firebase Admin connected successfully!");

module.exports = { db };
