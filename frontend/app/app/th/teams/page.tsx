import { thaiRouteMetadata, ThaiRoutePage } from '@/components/marketing/thai-route-page';

const PATH = '/teams';

export const metadata = thaiRouteMetadata(PATH);

export default function Page() {
  return <ThaiRoutePage path={PATH} />;
}
