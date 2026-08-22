import { thaiRouteMetadata, ThaiRoutePage } from '@/components/marketing/thai-route-page';

const PATH = '/integrations/vscode';

export const metadata = thaiRouteMetadata(PATH);

export default function Page() {
  return <ThaiRoutePage path={PATH} />;
}
