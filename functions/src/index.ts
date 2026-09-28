import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK with default credentials
admin.initializeApp();

// Export all Cloud Functions
export { logDomain } from "./logDomain";
export { digestEmail } from "./digestEmail";
export { redAlert } from "./redAlert";
export { heartbeat } from "./heartbeat";
export { generatePairingCode, pairDevice } from "./pairing";
