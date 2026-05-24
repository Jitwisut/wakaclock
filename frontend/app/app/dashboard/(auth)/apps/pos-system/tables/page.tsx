import { promises as fs } from 'fs';
import path from 'path';

import type { Table, TableCategory } from '@/app/dashboard/(auth)/apps/pos-system/store';
import PosSystemTableRender from '@/app/dashboard/(auth)/apps/pos-system/tables/tables-render';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'POS System App',
    description:
      'Product and order management application template for restaurants or online businesses. Built with shadcn/ui, Next.js and Tailwind CSS.',
    canonical: '/apps/ai-chat',
  });
}

async function getTableCategories(): Promise<TableCategory[]> {
  const data = await fs.readFile(
    path.join(process.cwd(), 'app/dashboard/(auth)/apps/pos-system/data/table-categories.json')
  );
  return JSON.parse(data.toString()) as TableCategory[];
}

async function getTables(): Promise<Table[]> {
  const data = await fs.readFile(
    path.join(process.cwd(), 'app/dashboard/(auth)/apps/pos-system/data/tables.json')
  );
  return JSON.parse(data.toString()) as Table[];
}

export default async function Page() {
  const tableCategories = await getTableCategories();
  const tables = await getTables();

  return <PosSystemTableRender tableCategories={tableCategories} tables={tables} />;
}
