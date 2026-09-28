import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

const API_SECRET = defineSecret("API_SECRET");

/**
 * Generate a 6-digit pairing code for a family.
 * Called from the parent dashboard (authenticated).
 */
export const generatePairingCode = onCall(
  {
    secrets: [API_SECRET],
    memory: "256MiB",
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const uid = request.auth.uid;

    // Look up the family this user belongs to
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }

    const userData = userDoc.data()!;
    const familyId = userData.familyId;

    if (!familyId) {
      throw new HttpsError(
        "failed-precondition",
        "User is not associated with a family"
      );
    }

    // Generate a unique 6-digit code
    const db = admin.firestore();
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await db.collection("pairingCodes").doc(code).get();
      if (!existing.exists) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new HttpsError("resource-exhausted", "Could not generate unique code");
    }

    // Store the code with 10-minute expiry
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 10 * 60 * 1000)
    );

    await db.collection("pairingCodes").doc(code!).set({
      familyId,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      used: false,
    });

    return { code: code!, expiresAt: expiresAt.toDate().toISOString() };
  }
);

/**
 * Pair a child device using a 6-digit code.
 * Called from the child app (unauthenticated or device-auth).
 */
export const pairDevice = onCall(
  {
    secrets: [API_SECRET],
    memory: "256MiB",
  },
  async (request) => {
    const { code, deviceId, platform, model, deviceName } = request.data || {};

    if (!code || !deviceId) {
      throw new HttpsError("invalid-argument", "Missing code or deviceId");
    }

    const db = admin.firestore();
    const codeRef = db.collection("pairingCodes").doc(code);

    // Use a transaction to prevent race conditions
    const result = await db.runTransaction(async (txn) => {
      const codeDoc = await txn.get(codeRef);

      if (!codeDoc.exists) {
        throw new HttpsError("not-found", "Invalid pairing code");
      }

      const codeData = codeDoc.data()!;

      if (codeData.used) {
        throw new HttpsError("already-exists", "Code has already been used");
      }

      const now = admin.firestore.Timestamp.now();
      if (codeData.expiresAt && codeData.expiresAt.toMillis() < now.toMillis()) {
        throw new HttpsError("deadline-exceeded", "Code has expired");
      }

      const familyId = codeData.familyId;

      // Mark code as used
      txn.update(codeRef, { used: true, usedAt: now, usedByDevice: deviceId });

      // Create / update device document
      const deviceRef = db.collection("devices").doc(deviceId);
      txn.set(
        deviceRef,
        {
          deviceId,
          familyId,
          platform: platform || "unknown",
          model: model || "unknown",
          deviceName: deviceName || model || "Child's device",
          pairedAt: now,
          lastHeartbeat: now,
          active: true,
        },
        { merge: true }
      );

      // Add device to the family's devices array
      const familyRef = db.collection("families").doc(familyId);
      txn.update(familyRef, {
        deviceIds: admin.firestore.FieldValue.arrayUnion(deviceId),
      });

      return { familyId };
    });

    return {
      familyId: result.familyId,
      paired: true,
    };
  }
);
