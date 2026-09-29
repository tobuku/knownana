import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { detectPlatform, platformLabel, installerMethod } from '../lib/platformDetect';
import { renderQR } from '../lib/qrCanvas';
import type { DetectedPlatform } from '../lib/platformDetect';

const functions = getFunctions(app);
const callGenerateInstaller = httpsCallable(functions, 'generateInstaller');

interface InstallerResult {
  deviceId: string;
  dohUrl: string;
  platform: string;
  method: 'script' | 'profile' | 'manual';
  script?: string;
  filename?: string;
  token?: string;
  transferToken?: string;
}

export default function InstallDevice() {
  const { user } = useAuth();
  const { bg, fg, fgMuted, border, borderLight } = useTheme();

  const detected = detectPlatform();
  const [platform, setPlatform] = useState<DetectedPlatform>(detected);
  const [deviceName, setDeviceName] = useState(platformLabel(detected));
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InstallerResult | null>(null);
  const [copied, setCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!user) return null;

  const projectId = 'knownana-c49d3';
  const transferUrl = result?.transferToken
    ? `https://us-central1-${projectId}.cloudfunctions.net/serveInstaller?token=${result.transferToken}`
    : '';

  async function handleInstall(e: React.MouseEvent) {
    e.preventDefault();
    if (installing) return;
    setInstalling(true);
    setError('');
    setResult(null);

    try {
      const res = await callGenerateInstaller({
        platform,
        deviceName: deviceName.trim() || platformLabel(platform),
      });
      const data = res.data as InstallerResult;
      setResult(data);

      // Auto-trigger download for Windows
      if (data.method === 'script' && data.script && data.filename) {
        const blob = new Blob([data.script], { type: 'application/x-bat' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // Auto-redirect for Mac/iOS profile download
      if (data.method === 'profile' && data.token) {
        const profileUrl = `https://us-central1-${projectId}.cloudfunctions.net/serveInstaller?token=${data.token}`;
        window.location.href = profileUrl;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setInstalling(false);
    }
  }

  function copyDohUrl() {
    if (!result?.dohUrl) return;
    navigator.clipboard.writeText(result.dohUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const method = installerMethod(platform);

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto', padding: '16px', background: bg, color: fg }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/dashboard" style={{ fontSize: '0.9em', color: fgMuted }}>&larr; Dashboard</Link>
        <h1 style={{ fontSize: '1.1em', marginTop: '8px' }}>Install on This Device</h1>
        <p style={{ fontSize: '0.85em', color: fgMuted, marginTop: '4px' }}>
          Run this on the child's device. Monitoring starts after install.
        </p>
      </div>

      {!result && (
        <section>
          {/* Platform detection */}
          <div style={{ fontSize: '0.85em', color: fgMuted, marginBottom: '12px' }}>
            Detected: <strong style={{ color: fg }}>{platformLabel(detected)}</strong>
            {detected !== platform && ' (overridden)'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85em', color: fgMuted, display: 'block', marginBottom: '4px' }}>
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => {
                  const p = e.target.value as DetectedPlatform;
                  setPlatform(p);
                  setDeviceName(platformLabel(p));
                }}
                style={{ width: '100%', padding: '6px', border: `1px solid ${border}`, background: bg, color: fg }}
              >
                <option value="windows">Windows PC</option>
                <option value="mac">Mac</option>
                <option value="ios">iPhone / iPad</option>
                <option value="android">Android</option>
                <option value="chromebook">Chromebook</option>
                <option value="linux">Linux PC</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85em', color: fgMuted, display: 'block', marginBottom: '4px' }}>
                Device name
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Kai's Laptop"
                style={{ width: '100%', padding: '6px', border: `1px solid ${border}`, background: bg, color: fg, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* What will happen */}
          <div style={{ fontSize: '0.85em', color: fgMuted, marginBottom: '16px', padding: '8px', border: `1px solid ${borderLight}` }}>
            {method === 'script' && 'Downloads a .bat file. Right-click > Run as administrator. Sets Chrome, Edge, and Firefox DNS automatically.'}
            {method === 'profile' && 'Downloads a configuration profile. Open it and approve in Settings to enable DNS monitoring system-wide.'}
            {method === 'manual' && 'Shows a DNS URL to copy into the browser\'s secure DNS settings (2-3 steps).'}
          </div>

          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <a
              href="#"
              onClick={handleInstall}
              style={{
                fontSize: '1.1em',
                fontWeight: 700,
                color: installing ? fgMuted : fg,
                textDecoration: 'underline',
              }}
            >
              {installing ? 'Setting up...' : 'INSTALL ON THIS DEVICE'}
            </a>
          </div>

          {error && (
            <div style={{ fontSize: '0.85em', color: '#cc0000', padding: '8px', border: `1px solid ${borderLight}` }}>
              {error}
            </div>
          )}
        </section>
      )}

      {/* Result: Windows */}
      {result && result.method === 'script' && (
        <section>
          <h3 style={{ fontSize: '1em', borderBottom: `1px solid ${borderLight}`, paddingBottom: '4px', marginBottom: '10px' }}>
            Windows - Almost done
          </h3>
          <ol style={{ paddingLeft: '20px', fontSize: '0.85em', lineHeight: 2, color: fgMuted }}>
            <li>The .bat file downloaded automatically. Find it in your Downloads folder.</li>
            <li><strong style={{ color: fg }}>Right-click</strong> the file &gt; <strong style={{ color: fg }}>Run as administrator</strong></li>
            <li>Click Yes on the admin prompt</li>
            <li>Restart all browsers on this device</li>
          </ol>

          <div style={{ fontSize: '0.85em', color: fgMuted, marginTop: '12px', padding: '8px', border: `1px solid ${borderLight}` }}>
            <strong>Fallback:</strong> If the .bat file doesn't work, open Chrome on this device and go to:<br />
            Settings &gt; Privacy &gt; Security &gt; Use secure DNS &gt; Custom<br />
            Paste: <strong style={{ color: fg, wordBreak: 'break-all' }}>{result.dohUrl}</strong>
            {' '}
            <a href="#" onClick={(e) => { e.preventDefault(); copyDohUrl(); }} style={{ color: fg }}>
              {copied ? 'Copied' : '[Copy]'}
            </a>
          </div>

          <div style={{ fontSize: '0.85em', color: fgMuted, marginTop: '12px' }}>
            Device ID: <strong style={{ color: fg }}>{result.deviceId}</strong>
          </div>
        </section>
      )}

      {/* Result: Mac / iOS profile */}
      {result && result.method === 'profile' && (
        <section>
          <h3 style={{ fontSize: '1em', borderBottom: `1px solid ${borderLight}`, paddingBottom: '4px', marginBottom: '10px' }}>
            {platform === 'ios' ? 'iPhone / iPad' : 'Mac'} - Install the profile
          </h3>

          {platform === 'ios' ? (
            <ol style={{ paddingLeft: '20px', fontSize: '0.85em', lineHeight: 2, color: fgMuted }}>
              <li>The profile downloaded. A notification should appear saying "Profile Downloaded".</li>
              <li>Go to <strong style={{ color: fg }}>Settings &gt; General &gt; VPN & Device Management</strong></li>
              <li>Tap <strong style={{ color: fg }}>KnowNana - {result.deviceId}</strong></li>
              <li>Tap <strong style={{ color: fg }}>Install</strong>, enter passcode, tap Install again</li>
            </ol>
          ) : (
            <ol style={{ paddingLeft: '20px', fontSize: '0.85em', lineHeight: 2, color: fgMuted }}>
              <li>The profile downloaded. Double-click the .mobileconfig file.</li>
              <li>Open <strong style={{ color: fg }}>System Settings &gt; Privacy & Security &gt; Profiles</strong></li>
              <li>Find <strong style={{ color: fg }}>KnowNana - {result.deviceId}</strong> and click Install</li>
              <li>Enter your Mac password to confirm</li>
            </ol>
          )}

          <div style={{ fontSize: '0.85em', color: fgMuted, marginTop: '12px' }}>
            Device ID: <strong style={{ color: fg }}>{result.deviceId}</strong>
          </div>

          {/* Send to device - for when child's phone has no browser */}
          {result.transferToken && (
            <SendToDevice
              transferUrl={transferUrl}
              qrCanvasRef={qrCanvasRef}
              fg={fg}
              fgMuted={fgMuted}
              border={border}
              borderLight={borderLight}
            />
          )}
        </section>
      )}

      {/* Result: Chromebook / Android / Linux - manual */}
      {result && result.method === 'manual' && (
        <section>
          <h3 style={{ fontSize: '1em', borderBottom: `1px solid ${borderLight}`, paddingBottom: '4px', marginBottom: '10px' }}>
            {platformLabel(platform)} - Copy DNS URL
          </h3>

          <div style={{
            padding: '10px',
            border: `1px solid ${border}`,
            marginBottom: '12px',
            wordBreak: 'break-all',
            fontSize: '0.9em',
          }}>
            {result.dohUrl}
            {' '}
            <a href="#" onClick={(e) => { e.preventDefault(); copyDohUrl(); }} style={{ color: fg }}>
              {copied ? 'Copied' : '[Copy]'}
            </a>
          </div>

          {platform === 'chromebook' && (
            <ol style={{ paddingLeft: '20px', fontSize: '0.85em', lineHeight: 2, color: fgMuted }}>
              <li>Open <strong style={{ color: fg }}>Chrome</strong> on this Chromebook</li>
              <li>Go to <strong style={{ color: fg }}>Settings &gt; Privacy and security &gt; Security</strong></li>
              <li>Under "Use secure DNS", select <strong style={{ color: fg }}>With &gt; Custom</strong></li>
              <li>Paste the URL above and press Enter</li>
            </ol>
          )}

          {platform === 'android' && (
            <ol style={{ paddingLeft: '20px', fontSize: '0.85em', lineHeight: 2, color: fgMuted }}>
              <li>Open <strong style={{ color: fg }}>Chrome</strong> on this device</li>
              <li>Go to <strong style={{ color: fg }}>Settings &gt; Privacy and security &gt; Security</strong></li>
              <li>Under "Use secure DNS", select <strong style={{ color: fg }}>Choose another provider</strong></li>
              <li>Paste the URL above and press Enter</li>
              <li style={{ marginTop: '8px' }}>
                <strong style={{ color: fg }}>Alternative (system-wide):</strong> Go to Android Settings &gt; Network &gt; Private DNS &gt; enter <strong style={{ color: fg }}>dns.knownana.com</strong>
              </li>
            </ol>
          )}

          {platform === 'linux' && (
            <ol style={{ paddingLeft: '20px', fontSize: '0.85em', lineHeight: 2, color: fgMuted }}>
              <li>Open <strong style={{ color: fg }}>Chrome or Firefox</strong> on this device</li>
              <li><strong>Chrome:</strong> Settings &gt; Privacy &gt; Security &gt; Use secure DNS &gt; Custom</li>
              <li><strong>Firefox:</strong> Settings &gt; Privacy &gt; DNS over HTTPS &gt; Max Protection &gt; Custom</li>
              <li>Paste the URL above</li>
            </ol>
          )}

          <div style={{ fontSize: '0.85em', color: fgMuted, marginTop: '12px' }}>
            Device ID: <strong style={{ color: fg }}>{result.deviceId}</strong>
          </div>
        </section>
      )}

      {result && (
        <div style={{ marginTop: '20px', fontSize: '0.85em', color: fgMuted }}>
          Done? <Link to="/dashboard" style={{ color: fg }}>Return to dashboard</Link> to verify logs appear.
        </div>
      )}
    </div>
  );
}

function SendToDevice({
  transferUrl,
  qrCanvasRef,
  fg,
  fgMuted,
  border,
  borderLight,
}: {
  transferUrl: string;
  qrCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  fg: string;
  fgMuted: string;
  border: string;
  borderLight: string;
}) {
  const [showTransfer, setShowTransfer] = useState(false);

  useEffect(() => {
    if (showTransfer && qrCanvasRef.current && transferUrl) {
      renderQR(qrCanvasRef.current, transferUrl, 200);
    }
  }, [showTransfer, transferUrl, qrCanvasRef]);

  const mailtoLink = `mailto:?subject=${encodeURIComponent('KnowNana Setup')}&body=${encodeURIComponent(
    'Open this link on the child\'s iPhone to install KnowNana DNS monitoring:\n\n' + transferUrl
  )}`;

  if (!showTransfer) {
    return (
      <div style={{ marginTop: '16px', padding: '10px', border: `1px solid ${borderLight}`, fontSize: '0.85em' }}>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); setShowTransfer(true); }}
          style={{ color: fg, textDecoration: 'underline' }}
        >
          No browser on the child's device?
        </a>
        <span style={{ color: fgMuted }}> - Send the profile from this device instead.</span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '16px', padding: '12px', border: `1px solid ${border}`, fontSize: '0.85em' }}>
      <strong style={{ color: fg }}>Send profile to child's device</strong>
      <p style={{ color: fgMuted, margin: '6px 0 12px' }}>
        The profile installs at the iOS system level - no browser needed on the child's phone once installed.
      </p>

      {/* QR Code */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, color: fg, marginBottom: '6px' }}>1. QR Code</div>
        <p style={{ color: fgMuted, margin: '0 0 8px' }}>
          Point the child's iPhone camera at this code. Tap the notification to download the profile.
        </p>
        <div style={{ textAlign: 'center' }}>
          <canvas ref={qrCanvasRef as React.RefObject<HTMLCanvasElement>} style={{ border: `1px solid ${borderLight}` }} />
        </div>
      </div>

      {/* AirDrop */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, color: fg, marginBottom: '6px' }}>2. AirDrop</div>
        <ol style={{ paddingLeft: '20px', color: fgMuted, lineHeight: 1.8, margin: '0' }}>
          <li>
            <a href={transferUrl} download style={{ color: fg, textDecoration: 'underline' }}>
              Download .mobileconfig
            </a>{' '}
            to this device
          </li>
          <li>Open Files app, find the downloaded file</li>
          <li>Tap Share, then AirDrop to the child's device</li>
          <li>On the child's device: Settings &gt; General &gt; VPN & Device Management &gt; Install</li>
        </ol>
      </div>

      {/* Email / iMessage */}
      <div>
        <div style={{ fontWeight: 600, color: fg, marginBottom: '6px' }}>3. Email or iMessage</div>
        <p style={{ color: fgMuted, margin: '0 0 6px' }}>
          <a href={mailtoLink} style={{ color: fg, textDecoration: 'underline' }}>
            Send via email
          </a>{' '}
          - or copy the link below and text/iMessage it. Open the link on the child's device to download the profile.
        </p>
        <div style={{
          padding: '6px 8px',
          background: `${borderLight}33`,
          border: `1px solid ${borderLight}`,
          wordBreak: 'break-all',
          fontSize: '0.9em',
          color: fgMuted,
        }}>
          {transferUrl}
        </div>
      </div>
    </div>
  );
}
