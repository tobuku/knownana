export type DetectedPlatform = 'windows' | 'mac' | 'ios' | 'android' | 'chromebook' | 'linux' | 'unknown';

export function detectPlatform(): DetectedPlatform {
  const ua = navigator.userAgent;

  // iOS: iPhone, iPad, iPod (including iPad pretending to be Mac with touch)
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/iPad/.test(ua)) return 'ios';
  // iPad with desktop UA (iOS 13+)
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';

  // Android
  if (/Android/.test(ua)) return 'android';

  // Chromebook: CrOS in UA
  if (/CrOS/.test(ua)) return 'chromebook';

  // Mac (after iPad check)
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';

  // Windows
  if (/Windows/.test(ua)) return 'windows';

  // Linux
  if (/Linux/.test(ua)) return 'linux';

  return 'unknown';
}

export function platformLabel(platform: DetectedPlatform): string {
  const labels: Record<DetectedPlatform, string> = {
    windows: 'Windows PC',
    mac: 'Mac',
    ios: 'iPhone / iPad',
    android: 'Android',
    chromebook: 'Chromebook',
    linux: 'Linux PC',
    unknown: 'Device',
  };
  return labels[platform];
}

export type InstallerMethod = 'script' | 'profile' | 'manual';

export function installerMethod(platform: DetectedPlatform): InstallerMethod {
  if (platform === 'windows') return 'script';
  if (platform === 'mac' || platform === 'ios') return 'profile';
  return 'manual';
}
