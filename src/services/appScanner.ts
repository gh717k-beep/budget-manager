import { NativeModules, Platform } from 'react-native';
import { InstalledApp } from '@/types/installedApp';

interface InstalledAppsNativeModule {
  getInstalledApps: () => Promise<string>;
  setSelectedPackages: (packagesJson: string) => Promise<void>;
}

const nativeModule = NativeModules.NotificationLogModule as InstalledAppsNativeModule | undefined;

export async function loadInstalledApps(): Promise<InstalledApp[]> {
  if (Platform.OS !== 'android' || !nativeModule) return [];
  const raw = await nativeModule.getInstalledApps();
  return JSON.parse(raw) as InstalledApp[];
}

export async function saveSelectedPackages(packages: string[]): Promise<void> {
  if (Platform.OS === 'android') await nativeModule?.setSelectedPackages(JSON.stringify(packages));
}