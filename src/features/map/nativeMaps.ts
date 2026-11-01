import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Whether react-native-maps can draw here. iPhone: Apple Maps, always. Android:
 * Google Maps, which needs an API key built into the app (app.json
 * android.config.googleMaps.apiKey); without one the map crashes or stays
 * blank, so the screens show their own map or list instead.
 */
export const nativeMapAvailable = Platform.OS !== 'android' || Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey);
