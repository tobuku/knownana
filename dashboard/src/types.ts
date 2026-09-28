export type CategoryColor = 'RED' | 'YELLOW' | 'GREEN' | 'GRAY';
export type Platform = 'ios' | 'android' | 'pc';

export interface DomainLog {
  id: string;
  domain: string;
  fullUrl?: string;
  pageTitle?: string;
  category: CategoryColor;
  categorySource: string;
  timestamp: Date;
  duration?: number;
  sourceApp?: string;
  platform: Platform;
  searchTerm?: string;
  deviceId: string;
}

export interface ChildDevice {
  id: string;
  name: string;
  deviceId: string;
  platform: Platform;
  lastHeartbeat: Date;
}

export interface FamilySettings {
  digestTime: string;
  timezone: string;
  alertsEnabled: boolean;
}

export interface CategoryOverride {
  domain: string;
  category: string;
}

export interface PairingCode {
  code: string;
  familyId: string;
  createdAt: Date;
  expiresAt: Date;
}
