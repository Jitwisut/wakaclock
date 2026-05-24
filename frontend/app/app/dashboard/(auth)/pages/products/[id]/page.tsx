import {
  CircleDollarSign,
  Edit3Icon,
  HandCoinsIcon,
  HeartIcon,
  Layers2Icon,
  ShoppingCart,
  StarIcon,
  Trash2Icon,
  TruckIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { generateMeta } from '@/lib/utils';

import ProductImageGallery from './product-image-gallery';
import ProductReviewList from './reviews';
import SubmitReviewForm from './submit-review-form';

export async function generateMetadata() {
  return generateMeta({
    title: 'Product Detail Page',
    description:
      'Use this shadcn/ui and Tailwind CSS product page template to create great looking pages for each product, with detailed descriptions, images, pricing, and customer reviews.',
    canonical: '/pages/products/detail',
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-start justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-xl tracking-tight lg:text-2xl">Acme Prism T-Shirt</h1>
          <div className="text-muted-foreground inline-flex flex-col gap-2 text-sm lg:flex-row lg:gap-4">
            <div>
              <span className="text-foreground font-semibold">Seller :</span> Poetic Fashion
            </div>
            <div>
              <span className="text-foreground font-semibold">Published :</span> 20 Oct, 2024
            </div>
            <div>
              <span className="text-foreground font-semibold">SKU :</span> WH1000XM4
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Edit3Icon />
            <span className="hidden lg:inline">Edit</span>
          </Button>
          <Button size="icon" variant="destructive">
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-1">
          <ProductImageGallery />
        </div>
        <div className="space-y-4 xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
              <CircleDollarSign className="size-6 opacity-40" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm">Price</span>
                <span className="text-lg font-semibold">$120.40</span>
              </div>
            </div>
            <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
              <TruckIcon className="size-6 opacity-40" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm">No. of Orders</span>
                <span className="text-lg font-semibold">250</span>
              </div>
            </div>
            <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
              <Layers2Icon className="size-6 opacity-40" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm">Available Stocks</span>
                <span className="text-lg font-semibold">2,550</span>
              </div>
            </div>
            <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
              <HandCoinsIcon className="size-6 opacity-40" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm">Total Revenue</span>
                <span className="text-lg font-semibold">$45,938</span>
              </div>
            </div>
          </div>
          <Card>
            <CardContent className="space-y-4">
              <div className="grid items-start gap-8 xl:grid-cols-3">
                <div className="space-y-8 xl:col-span-2">
                  <div>
                    <h3 className="mb-2 font-semibold">Description:</h3>
                    <p className="text-muted-foreground">
                      Tommy Hilfiger men striped pink sweatshirt. Crafted with cotton. Material
                      composition is 100% organic cotton.
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Key Features:</h3>
                    <ul className="text-muted-foreground list-inside list-disc">
                      <li>Industry-leading noise cancellation</li>
                      <li>30-hour battery life</li>
                      <li>Touch sensor controls</li>
                      <li>Speak-to-chat technology</li>
                    </ul>
                  </div>
                </div>
                <div className="rounded-md border xl:col-span-1">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-semibold">Category</TableCell>
                        <TableCell className="text-right">T-Shirt</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold">Brand</TableCell>
                        <TableCell className="text-right">Tommy Hilfiger</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold">Color</TableCell>
                        <TableCell className="text-right">Purple</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold">Weight</TableCell>
                        <TableCell className="text-right">140 Gr</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="grid auto-cols-max grid-flow-row gap-8">
                <div>
                  <div className="mb-4 font-semibold">Colors:</div>
                  <RadioGroup className="flex gap-2" defaultValue="card">
                    <div>
                      <RadioGroupItem
                        aria-label="Card"
                        className="peer sr-only"
                        id="card"
                        value="card"
                      />
                      <Label
                        className="border-muted hover:text-accent-foreground peer-data-[state=checked]:ring-primary [&:has([data-state=checked])]:border-primary flex size-8 cursor-pointer flex-col items-center justify-between rounded-full border bg-green-400 -indent-[9999px] peer-data-[state=checked]:ring"
                        htmlFor="card"
                      >
                        Card
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        aria-label="Paypal"
                        className="peer sr-only"
                        id="paypal"
                        value="paypal"
                      />
                      <Label
                        className="border-muted hover:text-accent-foreground peer-data-[state=checked]:ring-primary [&:has([data-state=checked])]:border-primary flex size-8 cursor-pointer flex-col items-center justify-between rounded-full border bg-indigo-400 -indent-[9999px] peer-data-[state=checked]:ring"
                        htmlFor="paypal"
                      >
                        Paypal
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        aria-label="Apple"
                        className="peer sr-only"
                        id="apple"
                        value="apple"
                      />
                      <Label
                        className="border-muted hover:text-accent-foreground peer-data-[state=checked]:ring-primary [&:has([data-state=checked])]:border-primary flex size-8 cursor-pointer flex-col items-center justify-between rounded-full border bg-purple-400 -indent-[9999px] peer-data-[state=checked]:ring"
                        htmlFor="apple"
                      >
                        Apple
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div>
                  <div className="mb-4 font-semibold">Sizes:</div>
                  <RadioGroup className="flex gap-2" defaultValue="md">
                    {['sm', 'md', 'lg', 'xl', 'xxl'].map((item) => (
                      <div key={item}>
                        <RadioGroupItem
                          aria-label={item}
                          className="peer sr-only"
                          id={item}
                          value={item}
                        />
                        <Label
                          className="hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary flex size-10 cursor-pointer flex-col items-center justify-center rounded-md border text-xs uppercase"
                          htmlFor={item}
                        >
                          {item}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button>
                  <ShoppingCart /> Add to Card
                </Button>
                <Button variant="outline">
                  <HeartIcon /> Wishlist
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row justify-between">
              <CardTitle>Reviews</CardTitle>
              <CardAction>
                <SubmitReviewForm />
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="order-last lg:order-first xl:col-span-2">
                  <ProductReviewList />
                </div>
                <div className="order-first lg:order-last xl:col-span-1">
                  <div className="overflow-hidden rounded-lg border">
                    <div className="bg-muted flex items-center gap-4 p-4">
                      <div className="flex items-center gap-1">
                        <StarIcon className="size-4 fill-orange-400 stroke-orange-400" />
                        <StarIcon className="size-4 fill-orange-400 stroke-orange-400" />
                        <StarIcon className="size-4 fill-orange-400 stroke-orange-400" />
                        <StarIcon className="size-4 stroke-orange-400" />
                        <StarIcon className="size-4 stroke-orange-400" />
                      </div>
                      <span className="text-muted-foreground text-sm">4.3 (12 reviews)</span>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="w-20">5 stars</span>
                        <Progress color="bg-orange-400" value={70} />
                        <span>70%</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="w-20">4 stars</span>
                        <Progress color="bg-orange-600" value={17} />
                        <span>17%</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="w-20">3 stars</span>
                        <Progress color="bg-yellow-300" value={7} />
                        <span>7%</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="w-20">2 stars</span>
                        <Progress color="bg-yellow-600" value={4} />
                        <span>4%</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="w-20">1 star</span>
                        <Progress color="bg-red-600" value={2} />
                        <span>2%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
