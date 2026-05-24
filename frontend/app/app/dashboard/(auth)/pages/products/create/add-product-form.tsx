'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircleIcon,
  ChevronLeft,
  CirclePlusIcon,
  ImageIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import AddNewCategory from '@/app/dashboard/(auth)/pages/products/create/add-category';
import { AddMediaFromUrl } from '@/app/dashboard/(auth)/pages/products/create/add-media-from-url';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useFileUpload } from '@/hooks/use-file-upload';

const FormSchema = z.object({
  name: z.string().min(2, {
    message: 'Product name must be at least 2 characters.',
  }),
  sku: z.string(),
  barcode: z.string(),
  description: z.string(),
  file: z.string(),
  variants: z.string(),
  price: z.string(),
  status: z.string(),
  category: z.string(),
  sub_category: z.string(),
});

export default function AddProductForm() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      sku: '',
      barcode: '',
      description: '',
    },
  });

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
    },
  ] = useFileUpload({
    accept: 'image/png,image/jpeg,image/jpg',
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: true,
    maxFiles: 5,
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast('You submitted the following values:', {
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="mb-4 flex flex-col justify-between space-y-4 lg:flex-row lg:items-center lg:space-y-2">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline">
              <Link href="/dashboard/pages/products">
                <ChevronLeft />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Add Products</h1>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary">
              Discard
            </Button>
            <Button type="button" variant="outline">
              Save Draft
            </Button>
            <Button type="submit">Publish</Button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-6">
          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Barcode</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormDescription>
                          Set a description to the product for better visibility.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
            {/* -- Product images -- */}
            <Card>
              <CardHeader>
                <CardTitle>Product Images</CardTitle>
                <CardAction>
                  <AddMediaFromUrl>
                    <Button className="mt-0! h-auto p-0" size="sm" variant="link">
                      <span className="hidden lg:block">Add media from URL</span>
                      <span className="block lg:hidden">Add URL</span>
                    </Button>
                  </AddMediaFromUrl>
                </CardAction>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="file"
                  render={() => (
                    <div className="flex flex-col gap-2">
                      <div
                        className="border-input data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 relative flex min-h-52 flex-col items-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:ring-[3px]"
                        data-dragging={isDragging || undefined}
                        data-files={files.length > 0 || undefined}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <input
                          {...getInputProps()}
                          aria-label="Upload image file"
                          className="sr-only"
                        />
                        {files.length > 0 ? (
                          <div className="flex w-full flex-col gap-3">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="truncate text-sm font-medium">
                                Uploaded Files ({files.length})
                              </h3>
                              <Button
                                disabled={files.length >= 5}
                                onClick={openFileDialog}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <UploadIcon
                                  aria-hidden="true"
                                  className="-ms-0.5 size-3.5 opacity-60"
                                />
                                Add more
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                              {files.map((file) => (
                                <div
                                  className="bg-accent relative aspect-square rounded-md border"
                                  key={file.id}
                                >
                                  <img
                                    alt={file.file.name}
                                    className="size-full rounded-[inherit] object-cover"
                                    src={file.preview}
                                  />
                                  <Button
                                    className="border-background focus-visible:border-background absolute -top-2 -right-2 size-6 rounded-full border-2 shadow-none"
                                    onClick={() => removeFile(file.id)}
                                    size="icon"
                                    type="button"
                                  >
                                    <XIcon className="size-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
                            <div
                              aria-hidden="true"
                              className="bg-background mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border"
                            >
                              <ImageIcon className="size-4 opacity-60" />
                            </div>
                            <p className="mb-1.5 text-sm font-medium">Drop your images here</p>
                            <p className="text-muted-foreground text-xs">PNG or JPG (max. 5MB)</p>
                            <Button
                              className="mt-4"
                              onClick={openFileDialog}
                              type="button"
                              variant="outline"
                            >
                              <UploadIcon aria-hidden="true" className="-ms-1 opacity-60" />
                              Select images
                            </Button>
                          </div>
                        )}
                      </div>

                      {errors.length > 0 && (
                        <div
                          className="text-destructive flex items-center gap-1 text-xs"
                          role="alert"
                        >
                          <AlertCircleIcon className="size-3 shrink-0" />
                          <span>{errors[0]}</span>
                        </div>
                      )}
                    </div>
                  )}
                />
              </CardContent>
            </Card>
            {/* -- Variants -- */}
            <Card className="pb-0">
              <CardHeader>
                <CardTitle>Variants</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="variants"
                  render={({ field }) => (
                    <div className="space-y-4">
                      <div className="grid gap-4 lg:grid-flow-col">
                        <FormItem>
                          <FormLabel>Options</FormLabel>
                          <Select {...field}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="size">Size</SelectItem>
                                <SelectItem value="color">Color</SelectItem>
                                <SelectItem value="weight">Weight</SelectItem>
                                <SelectItem value="smell">Smell</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        <FormItem>
                          <FormLabel>Price</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </div>
                      <div className="grid gap-4 lg:grid-flow-col">
                        <FormItem>
                          <Select {...field}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="size">Size</SelectItem>
                                <SelectItem value="color">Color</SelectItem>
                                <SelectItem value="weight">Weight</SelectItem>
                                <SelectItem value="smell">Smell</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                        <FormItem>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        <FormItem>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </div>
                    </div>
                  )}
                />
              </CardContent>
              <CardFooter className="justify-center border-t p-0!">
                <Button
                  className="w-full rounded-tl-none rounded-tr-none"
                  type="button"
                  variant="ghost"
                >
                  <CirclePlusIcon /> Add Variant
                </Button>
              </CardFooter>
            </Card>
          </div>
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Price</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discounted Price</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox id="terms" />
                    <label
                      className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      htmlFor="terms"
                    >
                      Charge tax on this product
                    </label>
                  </div>
                  <hr />
                  <div className="flex items-center space-x-2">
                    <Switch checked id="airplane-mode" />
                    <Label htmlFor="airplane-mode">In stock</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select {...field} defaultValue="draft">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="draft">
                                <span className="size-2 rounded-full bg-orange-400" /> Draft
                              </SelectItem>
                              <SelectItem value="active">
                                {' '}
                                <span className="size-2 rounded-full bg-green-400" /> Active
                              </SelectItem>
                              <SelectItem value="archived">
                                <span className="size-2 rounded-full bg-indigo-400" /> Archived
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>Set the product status.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="grow">
                              <Select {...field}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="Electronics">Electronics</SelectItem>
                                    <SelectItem value="Clothing">Clothing</SelectItem>
                                    <SelectItem value="banana">Accessories</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                            <AddNewCategory />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sub_category"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="grow">
                              <Select {...field}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select a sub category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="Toys">Toys</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                            <AddNewCategory />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
