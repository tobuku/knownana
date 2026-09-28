import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { Resend } from "resend";

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

interface LogEntry {
  domain: string;
  category: string;
  timestamp: admin.firestore.Timestamp;
  deviceId: string;
  queryType?: string;
}

interface DomainSummary {
  domain: string;
  visits: number;
  firstSeen: Date;
  lastSeen: Date;
  totalMinutes: number;
}

function groupLogs(logs: LogEntry[]): Record<string, DomainSummary[]> {
  const groups: Record<string, Map<string, DomainSummary>> = {
    RED: new Map(),
    YELLOW: new Map(),
    GREEN: new Map(),
    GRAY: new Map(),
  };

  for (const log of logs) {
    const cat = log.category || "GRAY";
    if (!groups[cat]) groups[cat] = new Map();
    const map = groups[cat];
    const existing = map.get(log.domain);
    const logTime = log.timestamp?.toDate() || new Date();

    if (existing) {
      existing.visits++;
      if (logTime < existing.firstSeen) existing.firstSeen = logTime;
      if (logTime > existing.lastSeen) existing.lastSeen = logTime;
      // Rough estimate: each DNS query represents ~2 min of activity
      existing.totalMinutes += 2;
    } else {
      map.set(log.domain, {
        domain: log.domain,
        visits: 1,
        firstSeen: logTime,
        lastSeen: logTime,
        totalMinutes: 2,
      });
    }
  }

  const result: Record<string, DomainSummary[]> = {};
  for (const [cat, map] of Object.entries(groups)) {
    result[cat] = Array.from(map.values()).sort(
      (a, b) => b.totalMinutes - a.totalMinutes
    );
  }
  return result;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildPlainText(
  grouped: Record<string, DomainSummary[]>,
  totalDomains: number,
  totalMinutes: number,
  monitoringStatus: string
): string {
  const lines: string[] = [];

  lines.push(`MONITORING STATUS: ${monitoringStatus}`);
  lines.push(
    `Total domains: ${totalDomains} | Time online: ${formatTime(totalMinutes)}`
  );
  lines.push("");

  if (grouped.RED && grouped.RED.length > 0) {
    lines.push(`--- RED (${grouped.RED.length}) ---`);
    for (const d of grouped.RED) {
      lines.push(
        `${d.domain} - ${formatClockTime(d.firstSeen)} - ${formatTime(d.totalMinutes)}`
      );
    }
    lines.push("");
  }

  if (grouped.YELLOW && grouped.YELLOW.length > 0) {
    lines.push(`--- YELLOW (${grouped.YELLOW.length}) ---`);
    for (const d of grouped.YELLOW) {
      lines.push(
        `${d.domain} - ${d.visits} visits - ${formatTime(d.totalMinutes)} total`
      );
    }
    lines.push("");
  }

  if (grouped.GREEN && grouped.GREEN.length > 0) {
    lines.push(`--- GREEN (${grouped.GREEN.length}) ---`);
    for (const d of grouped.GREEN) {
      lines.push(`${d.domain} - ${formatTime(d.totalMinutes)}`);
    }
    lines.push("");
  }

  if (grouped.GRAY && grouped.GRAY.length > 0) {
    const top = grouped.GRAY.slice(0, 10);
    lines.push(`--- GRAY (${grouped.GRAY.length}, top 10) ---`);
    for (const d of top) {
      lines.push(`${d.domain} - ${formatTime(d.totalMinutes)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildHtml(
  grouped: Record<string, DomainSummary[]>,
  totalDomains: number,
  totalMinutes: number,
  monitoringStatus: string,
  childName: string
): string {
  const section = (
    title: string,
    color: string,
    items: DomainSummary[],
    limit?: number
  ) => {
    if (!items || items.length === 0) return "";
    const shown = limit ? items.slice(0, limit) : items;
    const countLabel = limit && items.length > limit
      ? `${items.length}, top ${limit}`
      : `${items.length}`;

    let rows = "";
    for (const d of shown) {
      const detail =
        color === "#dc2626"
          ? `${formatClockTime(d.firstSeen)} - ${formatTime(d.totalMinutes)}`
          : color === "#f59e0b"
            ? `${d.visits} visits - ${formatTime(d.totalMinutes)} total`
            : formatTime(d.totalMinutes);
      rows += `<tr><td style="padding:4px 8px;">${d.domain}</td><td style="padding:4px 8px;color:#666;">${detail}</td></tr>`;
    }

    return `
      <div style="margin-bottom:16px;">
        <h3 style="color:${color};margin:0 0 4px 0;">${title} (${countLabel})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      </div>`;
  };

  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="margin:0 0 8px 0;">KnowNana Daily Digest - ${childName}</h2>
      <p style="margin:0 0 4px 0;"><strong>Monitoring Status:</strong> ${monitoringStatus}</p>
      <p style="margin:0 0 16px 0;">Total domains: ${totalDomains} | Time online: ${formatTime(totalMinutes)}</p>
      ${section("RED", "#dc2626", grouped.RED || [])}
      ${section("YELLOW", "#f59e0b", grouped.YELLOW || [])}
      ${section("GREEN", "#16a34a", grouped.GREEN || [])}
      ${section("GRAY", "#6b7280", grouped.GRAY || [], 10)}
      <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;" />
      <p style="font-size:12px;color:#9ca3af;">Sent by KnowNana - alerts@knownana.com</p>
    </div>`;
}

export const digestEmail = onSchedule(
  {
    schedule: "every 1 hours",
    secrets: [RESEND_API_KEY],
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const resend = new Resend(RESEND_API_KEY.value());
    const db = admin.firestore();
    const now = new Date();
    const currentHour = now.getUTCHours();

    // Get all families
    const familiesSnap = await db.collection("families").get();

    for (const familyDoc of familiesSnap.docs) {
      const family = familyDoc.data();
      const familyId = familyDoc.id;

      // Check if this family's digest is due this hour
      // digestHourUTC is stored as 0-23 (UTC hour for their preferred time)
      const digestHour = family.digestHourUTC ?? 7; // default 7 UTC = ~9PM HST
      if (digestHour !== currentHour) continue;

      // Check if digest is enabled and parent email exists
      const parentEmail = family.parentEmail;
      if (!parentEmail || family.digestEnabled === false) continue;

      const childName = family.childName || "Your child";

      try {
        // Get today's logs (last 24 hours)
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const logsSnap = await db
          .collection("families")
          .doc(familyId)
          .collection("logs")
          .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(yesterday))
          .orderBy("createdAt", "asc")
          .get();

        const logs: LogEntry[] = logsSnap.docs.map((d) => d.data() as LogEntry);

        // Check monitoring status (look for gaps > 10 min in heartbeats)
        const interruptions = await db
          .collection("families")
          .doc(familyId)
          .collection("events")
          .where("type", "==", "MONITORING_INTERRUPTED")
          .where(
            "timestamp",
            ">=",
            admin.firestore.Timestamp.fromDate(yesterday)
          )
          .get();

        const monitoringStatus =
          interruptions.empty
            ? "Active (no interruptions)"
            : `${interruptions.size} interruption(s) detected`;

        // Group and summarize
        const grouped = groupLogs(logs);
        const totalDomains = new Set(logs.map((l) => l.domain)).size;
        const totalMinutes = logs.length * 2; // rough: 2 min per DNS query

        const plainText = buildPlainText(
          grouped,
          totalDomains,
          totalMinutes,
          monitoringStatus
        );

        const html = buildHtml(
          grouped,
          totalDomains,
          totalMinutes,
          monitoringStatus,
          childName
        );

        // Send via Resend
        await resend.emails.send({
          from: "KnowNana <alerts@knownana.com>",
          to: [parentEmail],
          subject: `KnowNana Daily Digest - ${childName} - ${now.toLocaleDateString("en-US")}`,
          text: plainText,
          html: html,
        });

        // Mark digest as sent
        await db.collection("families").doc(familyId).update({
          lastDigestSent: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Digest sent for family ${familyId} to ${parentEmail}`);
      } catch (err) {
        console.error(`Failed to send digest for family ${familyId}:`, err);
      }
    }
  }
);
