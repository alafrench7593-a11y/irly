import { Redirect, useLocalSearchParams } from 'expo-router';

/** Deep link …/search?q=… lands on Discover with the query filled in. */
export default function SearchLink() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  return <Redirect href={{ pathname: '/discover', params: { q: q ?? '' } }} />;
}
