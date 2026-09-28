import {
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { Resend } from "resend";

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

export const redAlert = onDocumentCreated(
  {
    document: "families/{familyId}/logs/{logId}",
    secrets: [RESEND_API_KEY],
    memory: "256MiB",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (!data || data.category !== "RED") return;

    const familyId = event.params.familyId;

    try {
      // Get family settings
      const familyDoc = await admin
        .firestore()
        .collection("families")
        .doc(familyId)
        .get();

      if (!familyDoc.exists) {
        console.error(`Family ${familyId} not found`);
        return;
      }

      const family = familyDoc.data()!;

      // Check if alerts are enabled
      if (family.alertsEnabled === false) {
        console.log(`Alerts disabled for family ${familyId}, skipping`);
        return;
      }

      const parentEmail = family.parentEmail;
      if (!parentEmail) {
        console.error(`No parent email for family ${familyId}`);
        return;
      }

      const childName = family.childName || "Your child";
      const domain = data.domain || "unknown";
      const timestamp = data.timestamp?.toDate
        ? data.timestamp.toDate()
        : new Date();
      const timeStr = timestamp.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      // Look up device name
      let deviceName = "Unknown device";
      if (data.deviceId) {
        const deviceSnap = await admin
          .firestore()
          .collection("devices")
          .where("deviceId", "==", data.deviceId)
          .limit(1)
          .get();

        if (!deviceSnap.empty) {
          const deviceData = deviceSnap.docs[0].data();
          deviceName = deviceData.deviceName || deviceData.model || "Unknown device";
        }
      }

      const resend = new Resend(RESEND_API_KEY.value());

      await resend.emails.send({
        from: "KnowNana Alerts <alerts@knownana.com>",
        to: [parentEmail],
        subject: `RED ALERT - ${domain} accessed on ${childName}'s device`,
        text: [
          `RED ALERT - Restricted domain accessed`,
          ``,
          `Domain: ${domain}`,
          `Time: ${timeStr}`,
          `Device: ${deviceName}`,
          `Child: ${childName}`,
          ``,
          `This domain is categorized as RED (restricted) in your KnowNana settings.`,
          ``,
          `- KnowNana`,
        ].join("\n"),
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:#dc2626;color:#fff;padding:12px 16px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;font-size:18px;">RED ALERT</h2>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;padding:16px;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 12px 0;font-size:16px;">A restricted domain was accessed on <strong>${childName}'s</strong> device.</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:6px 0;color:#666;width:80px;">Domain</td><td style="padding:6px 0;"><strong style="color:#dc2626;">${domain}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#666;">Time</td><td style="padding:6px 0;">${timeStr}</td></tr>
                <tr><td style="padding:6px 0;color:#666;">Device</td><td style="padding:6px 0;">${deviceName}</td></tr>
              </table>
            </div>
            <p style="font-size:12px;color:#9ca3af;margin-top:12px;">Sent by KnowNana - alerts@knownana.com</p>
          </div>`,
      });

      console.log(`RED alert sent for ${domain} to ${parentEmail}`);
    } catch (err) {
      console.error(`Failed to send RED alert for family ${familyId}:`, err);
    }
  }
);
