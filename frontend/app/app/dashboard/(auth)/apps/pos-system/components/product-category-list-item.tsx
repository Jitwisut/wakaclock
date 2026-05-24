import type { ProductCategory } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { RadioGroupItem } from '@/components/ui/radio-group';

type ProductCategoryListItemProps = {
  category: ProductCategory;
};

export default function ProductCategoryListItem({ category }: ProductCategoryListItemProps) {
  return (
    <div
      className="has-data-[state=checked]:border-primary has-focus-visible:border-ring has-focus-visible:ring-ring/50 hover:bg-muted relative flex w-24 cursor-pointer flex-col items-center gap-4 rounded-md border px-2 py-2 text-center outline-none lg:w-32 lg:py-6"
      key={category.id}
    >
      <RadioGroupItem className="sr-only" id={`c-${category.id}`} value={category.id.toString()} />
      <span className="text-3xl lg:text-4xl">{category.icon}</span>
      <label
        className="text-foreground cursor-pointer leading-none after:absolute after:inset-0"
        htmlFor={`c-${category.id}`}
      >
        {category.name}
      </label>
    </div>
  );
}
