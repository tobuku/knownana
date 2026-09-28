import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { categorize } from "./categorize";

const API_SECRET = defineSecret("API_SECRET");

// Simple in-memory rate limiter (per function instance)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(deviceId: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(deviceId);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(deviceId, { count: 1, resetAt: now + 1000 });
    return false;
  }

  entry.count++;
  return entry.count > 100;
}

export const logDomain = onRequest(
  {
    secrets: [API_SECRET],
    cors: true,
    maxInstances: 50,
    memory: "256MiB",
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Validate API key
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== API_SECRET.value()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { domain, deviceId, timestamp, queryType } = req.body;

    // Validate required fields
    if (!domain || !deviceId) {
      res.status(400).json({ error: "Missing domain or deviceId" });
      return;
    }

    // Rate limit check
    if (isRateLimited(deviceId)) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }

    try {
      // Look up which family this device belongs to
      const devicesSnap = await admin
        .firestore()
        .collection("devices")
        .where("deviceId", "==", deviceId)
        .limit(1)
        .get();

      if (devicesSnap.empty) {
        res.status(404).json({ error: "Device not found" });
        return;
      }

      const deviceDoc = devicesSnap.docs[0];
      const familyId = deviceDoc.data().familyId as string;

      if (!familyId) {
        res.status(400).json({ error: "Device not linked to a family" });
        return;
      }

      // Categorize the domain
      const { category, source } = await categorize(domain, familyId);

      const logEntry = {
        domain,
        deviceId,
        queryType: queryType || "A",
        category,
        categorySource: source,
        timestamp: timestamp
          ? admin.firestore.Timestamp.fromDate(new Date(timestamp))
          : admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Write to the family's logs subcollection
      const logRef = await admin
        .firestore()
        .collection("families")
        .doc(familyId)
        .collection("logs")
        .add(logEntry);

      // If RED, also write to redAlerts to trigger the onCreate alert
      if (category === "RED") {
        await admin
          .firestore()
          .collection("families")
          .doc(familyId)
          .collection("redAlerts")
          .doc(logRef.id)
          .set(logEntry);
      }

      res.status(200).json({ ok: true, category });
    } catch (err) {
      console.error("logDomain error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
