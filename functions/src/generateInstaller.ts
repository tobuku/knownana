import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

function generateDeviceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "kn-";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function buildWindowsBat(deviceId: string, dohUrl: string): string {
  return `@echo off
REM KnowNana DNS Monitor Installer for Windows
REM Device: ${deviceId}
REM This script sets Chrome, Edge, and Firefox to use KnowNana DNS-over-HTTPS.

:: Check for admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ============================================
echo   KnowNana DNS Monitor - Installing...
echo ============================================
echo.

REM --- Chrome: Set DoH via registry policy ---
reg add "HKLM\\SOFTWARE\\Policies\\Google\\Chrome" /v DnsOverHttpsMode /t REG_SZ /d "secure" /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Policies\\Google\\Chrome" /v DnsOverHttpsTemplates /t REG_SZ /d "${dohUrl}" /f >nul 2>&1
echo [OK] Chrome DNS-over-HTTPS configured

REM --- Edge: Set DoH via registry policy ---
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v DnsOverHttpsMode /t REG_SZ /d "secure" /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v DnsOverHttpsTemplates /t REG_SZ /d "${dohUrl}" /f >nul 2>&1
echo [OK] Edge DNS-over-HTTPS configured

REM --- Firefox: Set DoH via policies.json ---
set "FF_POLICY_DIR=%ProgramFiles%\\Mozilla Firefox\\distribution"
if not exist "%FF_POLICY_DIR%" mkdir "%FF_POLICY_DIR%"
(
echo {
echo   "policies": {
echo     "DNSOverHTTPS": {
echo       "Enabled": true,
echo       "ProviderURL": "${dohUrl}",
echo       "Locked": true
echo     }
echo   }
echo }
) > "%FF_POLICY_DIR%\\policies.json"
echo [OK] Firefox DNS-over-HTTPS configured

echo.
echo ============================================
echo   Installation complete!
echo   Please restart all browsers for changes
echo   to take effect.
echo ============================================
echo.
pause
`;
}

function buildMobileconfig(deviceId: string, dohUrl: string): string {
  const payloadUUID = crypto.randomUUID();
  const profileUUID = crypto.randomUUID();

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>DNSSettings</key>
      <dict>
        <key>DNSProtocol</key>
        <string>HTTPS</string>
        <key>ServerURL</key>
        <string>${dohUrl}</string>
      </dict>
      <key>PayloadDisplayName</key>
      <string>KnowNana DNS Monitor</string>
      <key>PayloadIdentifier</key>
      <string>com.knownana.dns.${deviceId}</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>${payloadUUID}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>KnowNana - ${deviceId}</string>
  <key>PayloadIdentifier</key>
  <string>com.knownana.profile.${deviceId}</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${profileUUID}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadDescription</key>
  <string>Routes DNS queries through KnowNana for parental monitoring.</string>
</dict>
</plist>`;
}

export const generateInstaller = onCall(
  {
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const uid = request.auth.uid;
    const { platform, deviceName } = request.data || {};

    if (!platform) {
      throw new HttpsError("invalid-argument", "Missing platform");
    }

    // Look up user's family
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }

    const familyId = userDoc.data()!.familyId;
    if (!familyId) {
      throw new HttpsError(
        "failed-precondition",
        "User is not associated with a family"
      );
    }

    // Generate unique device ID
    const db = admin.firestore();
    let deviceId: string;
    let attempts = 0;
    do {
      deviceId = generateDeviceId();
      const existing = await db.collection("devices").doc(deviceId).get();
      if (!existing.exists) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new HttpsError("resource-exhausted", "Could not generate unique device ID");
    }

    const now = admin.firestore.Timestamp.now();
    const dohUrl = `https://dns.knownana.com/dns-query/${deviceId}`;

    // Register device in Firestore
    await db.collection("devices").doc(deviceId).set({
      deviceId,
      familyId,
      platform,
      model: platform,
      deviceName: deviceName || `${platform} device`,
      active: true,
      pairedAt: now,
      lastHeartbeat: now,
    });

    // Add to family's device list
    await db.collection("families").doc(familyId).update({
      deviceIds: admin.firestore.FieldValue.arrayUnion(deviceId),
    });

    // Build platform-specific response
    if (platform === "windows") {
      const script = buildWindowsBat(deviceId, dohUrl);
      return {
        deviceId,
        dohUrl,
        platform,
        method: "script",
        script,
        filename: `knownana-install-${deviceId}.bat`,
      };
    }

    if (platform === "mac" || platform === "ios") {
      const mobileconfig = buildMobileconfig(deviceId, dohUrl);
      const tokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      const expiresAt = admin.firestore.Timestamp.fromDate(tokenExpires);

      // Token for immediate download (auto-redirect)
      const token = crypto.randomBytes(24).toString("hex");
      // Second token for send-to-device (QR, AirDrop, email)
      const transferToken = crypto.randomBytes(24).toString("hex");

      const batch = db.batch();
      const tokenData = {
        deviceId,
        familyId,
        platform,
        mobileconfig,
        createdAt: now,
        expiresAt,
      };
      batch.set(db.collection("installerTokens").doc(token), tokenData);
      batch.set(db.collection("installerTokens").doc(transferToken), tokenData);
      await batch.commit();

      return {
        deviceId,
        dohUrl,
        platform,
        method: "profile",
        token,
        transferToken,
      };
    }

    // Chromebook, Android, Linux, unknown - manual copy
    return {
      deviceId,
      dohUrl,
      platform,
      method: "manual",
    };
  }
);
