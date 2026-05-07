import { Suspense } from 'react';
import SearchRouteClient from '../../src/components/routes/SearchRouteClient.jsx';

export default function SearchRoute() {
  return (
    <Suspense fallback={null}>
      <SearchRouteClient />
    </Suspense>
  );
}
