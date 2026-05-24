'use client';

import React from 'react';

import { FileEdit, Search, SearchIcon } from 'lucide-react';
import Link from 'next/link';

import AddProductDialog from '@/app/dashboard/(auth)/apps/pos-system/components/add-product-dialog';
import AssignOrderToTable from '@/app/dashboard/(auth)/apps/pos-system/components/assign-order-to-table';
import POStSystemCart from '@/app/dashboard/(auth)/apps/pos-system/components/cart';
import POStSystemCartSheet from '@/app/dashboard/(auth)/apps/pos-system/components/cart-sheet';
import ProductCategoryListItem from '@/app/dashboard/(auth)/apps/pos-system/components/product-category-list-item';
import ProductListItem from '@/app/dashboard/(auth)/apps/pos-system/components/product-list-item';
import type {
  Product,
  ProductCategory,
  Table,
  TableCategory,
} from '@/app/dashboard/(auth)/apps/pos-system/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup } from '@/components/ui/radio-group';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

type PosSystemMenuProps = {
  productCategories: ProductCategory[];
  products: Product[];
  tableCategories: TableCategory[];
  tables: Table[];
};

export default function PosSystemMenu({
  productCategories,
  products,
  tableCategories,
  tables,
}: PosSystemMenuProps) {
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [showAssignOrderDialog, setShowAssignOrderDialog] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<null | string>(null);

  const filteredBySearchTerm = React.useMemo(() => {
    if (!searchTerm) return null;
    return products.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, products]);

  const filteredByCategory = React.useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [selectedCategory, products]);

  const filteredProducts = filteredBySearchTerm || filteredByCategory;

  return (
    <>
      <div className="grid-cols-8 gap-4 lg:grid">
        <div className="flex flex-col gap-4 group-data-[theme-content-layout=centered]/layout:h-[calc(100vh-8rem)] group-data-[theme-content-layout=full]/layout:h-[calc(100vh-6rem)] lg:col-span-6">
          {/* Header */}
          <div className="flex justify-between lg:mb-4">
            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Pos System</h1>
            <div className="flex gap-2">
              <AddProductDialog categories={productCategories} />
              <Button asChild variant="outline">
                <Link href="/dashboard/apps/pos-system/tables">
                  <FileEdit />
                  <span className="hidden sm:inline">Tables</span>
                </Link>
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button className="flex lg:hidden" size="icon" variant="outline">
                    <SearchIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                    <Input
                      className="pl-8"
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search menu..."
                      value={searchTerm}
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <div className="hidden gap-2 lg:flex">
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                  <Input
                    className="pl-8"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search menu..."
                    value={searchTerm}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Header */}

          {/* Categories */}
          <ScrollArea className="w-full whitespace-nowrap">
            <RadioGroup
              className="flex gap-4"
              defaultValue="all"
              onValueChange={(value) => {
                setSelectedCategory(value === 'all' ? null : value);
                setSearchTerm('');
              }}
            >
              <ProductCategoryListItem
                category={{
                  id: 'all',
                  name: 'All',
                  icon: '🍱',
                }}
              />
              {productCategories.map((category) => (
                <ProductCategoryListItem category={category} key={category.id} />
              ))}
            </RadioGroup>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          {/* Categories */}

          {/* Products */}
          <div className="flex-1 space-y-20 overflow-auto">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredProducts.map((product) => (
                  <ProductListItem key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <div className="text-muted-foreground">There are no products here.</div>
                <AddProductDialog categories={productCategories} />
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <POStSystemCart setShowAssignOrderDialogAction={setShowAssignOrderDialog} />
        <POStSystemCartSheet setShowAssignOrderDialogAction={setShowAssignOrderDialog} />
      </div>

      <AssignOrderToTable
        open={showAssignOrderDialog}
        setOpen={setShowAssignOrderDialog}
        tableCategories={tableCategories}
        tables={tables}
      />
    </>
  );
}
