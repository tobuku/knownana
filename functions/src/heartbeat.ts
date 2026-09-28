import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

const API_SECRET = defineSecret("API_SECRET");

export const heartbeat = onRequest(
  {
    secrets: [API_SECRET],
    cors: true,
    maxInstances: 20,
    memory: "256MiB",
  },
  async (req, res) => {
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

    const { deviceId, familyId, platform, timestamp } = req.body;

    if (!deviceId || !familyId) {
      res.status(400).json({ error: "Missing deviceId or familyId" });
      return;
    }

    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    try {
      const deviceRef = db.collection("devices").doc(deviceId);
      const deviceDoc = await deviceRef.get();

      if (!deviceDoc.exists) {
        res.status(404).json({ error: "Device not found" });
        return;
      }

      const deviceData = deviceDoc.data()!;

      // Check for monitoring gap (> 10 minutes since last heartbeat)
      const lastHeartbeat = deviceData.lastHeartbeat as admin.firestore.Timestamp | undefined;
      if (lastHeartbeat) {
        const gapMs = now.toMillis() - lastHeartbeat.toMillis();
        const tenMinutesMs = 10 * 60 * 1000;

        if (gapMs > tenMinutesMs) {
          // Log a MONITORING_INTERRUPTED event
          await db
            .collection("families")
            .doc(familyId)
            .collection("events")
            .add({
              type: "MONITORING_INTERRUPTED",
              deviceId,
              gapMinutes: Math.round(gapMs / 60000),
              lastHeartbeat,
              resumedAt: now,
              timestamp: now,
            });

          console.log(
            `Monitoring gap detected: device ${deviceId}, gap ${Math.round(gapMs / 60000)} min`
          );
        }
      }

      // Update the device's last heartbeat
      await deviceRef.update({
        lastHeartbeat: now,
        platform: platform || deviceData.platform,
        lastTimestamp: timestamp || null,
      });

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("heartbeat error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
