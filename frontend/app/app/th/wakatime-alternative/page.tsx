import { thaiRouteMetadata, ThaiRoutePage } from '@/components/marketing/thai-route-page';

const PATH = '/wakatime-alternative';

export const metadata = thaiRouteMetadata(PATH);

export default function Page() {
  return <ThaiRoutePage path={PATH} />;
}
