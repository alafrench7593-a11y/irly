import { Redirect } from 'expo-router';

/**
 * Unknown URLs (including the path a web preview is hosted under) fall
 * back to the entry gate instead of showing an error page.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
