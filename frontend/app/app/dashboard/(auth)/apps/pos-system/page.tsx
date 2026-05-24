import { promises as fs } from 'fs';
import path from 'path';

import PosSystemMenu from '@/app/dashboard/(auth)/apps/pos-system/pos-system-menu';
import type {
  Product,
  ProductCategory,
  Table,
  TableCategory,
} from '@/app/dashboard/(auth)/apps/pos-system/store';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'POS System App',
    description:
      'Product and order management application template for restaurants or online businesses. Built with shadcn/ui, Next.js and Tailwind CSS.',
    canonical: '/apps/pos-system-app',
  });
}

async function getProductCategories(): Promise<ProductCategory[]> {
  const data = await fs.readFile(
    path.join(process.cwd(), 'app/dashboard/(auth)/apps/pos-system/data/product-categories.json')
  );
  return JSON.parse(data.toString()) as ProductCategory[];
}

async function getProducts(): Promise<Product[]> {
  const data = await fs.readFile(
    path.join(process.cwd(), 'app/dashboard/(auth)/apps/pos-system/data/products.json')
  );
  return JSON.parse(data.toString()) as Product[];
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
  const productCategories = await getProductCategories();
  const products = await getProducts();
  const tables = await getTables();
  const tableCategories = await getTableCategories();

  return (
    <PosSystemMenu
      productCategories={productCategories}
      products={products}
      tableCategories={tableCategories}
      tables={tables}
    />
  );
}
