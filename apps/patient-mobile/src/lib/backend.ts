import { Platform } from 'react-native';

/**
 * Resolve the Node backend base URL for the current platform.
 * Android emulators treat localhost as the emulator itself — map to 10.0.2.2
 * (host loopback). Physical devices should set EXPO_PUBLIC_BACKEND_URL to the
 * machine's LAN IP.
 */
export function getBackendUrl(): string {
  const raw = (
    process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:4000'
  ).replace(/\/$/, '');

  if (Platform.OS !== 'android') return raw;

  try {
    const url = new URL(raw);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = '10.0.2.2';
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    /* keep raw */
  }

  return raw;
}
