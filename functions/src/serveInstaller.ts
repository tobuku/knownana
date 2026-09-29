import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * HTTP endpoint to serve .mobileconfig files for iOS/Mac.
 * Safari blocks JavaScript Blob downloads of .mobileconfig,
 * so we need a real HTTP endpoint with the correct Content-Type.
 *
 * GET /serveInstaller?token=<token>
 */
export const serveInstaller = onRequest(
  {
    memory: "256MiB",
    cors: false,
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }

    const token = req.query.token as string;
    if (!token) {
      res.status(400).send("Missing token");
      return;
    }

    const db = admin.firestore();
    const tokenDoc = await db.collection("installerTokens").doc(token).get();

    if (!tokenDoc.exists) {
      res.status(404).send("Invalid or expired token");
      return;
    }

    const data = tokenDoc.data()!;

    // Check expiry
    const now = admin.firestore.Timestamp.now();
    if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
      // Clean up expired token
      await db.collection("installerTokens").doc(token).delete();
      res.status(410).send("Token expired");
      return;
    }

    const mobileconfig = data.mobileconfig as string;
    const deviceId = data.deviceId as string;

    if (!mobileconfig) {
      res.status(500).send("No profile data found");
      return;
    }

    // Delete token after use (one-time download)
    await db.collection("installerTokens").doc(token).delete();

    // Serve the .mobileconfig with correct headers
    res.setHeader("Content-Type", "application/x-apple-asn1");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="knownana-${deviceId}.mobileconfig"`
    );
    res.status(200).send(mobileconfig);
  }
);
