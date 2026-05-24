'use client';

import React, { useEffect, useState } from 'react';

import {
  ChevronDownIcon,
  File,
  FileTextIcon,
  Folder,
  FolderPlus,
  Home,
  MoreHorizontalIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import FileManagerPagination from '@/app/dashboard/(auth)/apps/file-manager/components/pagination';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

import allFileItems from '../data.json';

import { FileUploadDialog } from './file-upload-dialog';

type FileItem = (typeof allFileItems)[number];

function getFileIcon(iconType: string) {
  switch (iconType) {
    case 'folder': {
      return <Folder className="h-5 w-5 text-yellow-600" />;
    }
    case 'figma': {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-purple-500 text-xs font-bold text-white">
          F
        </div>
      );
    }
    case 'sketch': {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-yellow-500 text-xs font-bold text-white">
          S
        </div>
      );
    }
    case 'word': {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
          W
        </div>
      );
    }
    case 'illustrator': {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-orange-600 text-xs font-bold text-white">
          Ai
        </div>
      );
    }
    case 'photoshop': {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-800 text-xs font-bold text-white">
          Ps
        </div>
      );
    }
    case 'pdf': {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-red-600 text-xs font-bold text-white">
          <FileTextIcon className="size-3" />
        </div>
      );
    }
    case 'audio': {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-green-600 text-xs font-bold text-white">
          ♪
        </div>
      );
    }
    default: {
      return <File className="h-5 w-5 text-gray-500" />;
    }
  }
}

type SortOption = 'date' | 'name' | 'size';
type SortDirection = 'asc' | 'desc';

function parseFileSize(sizeStr: string): number {
  const size = Number.parseFloat(sizeStr);
  if (sizeStr.includes('GB')) return size * 1024 * 1024 * 1024;
  if (sizeStr.includes('MB')) return size * 1024 * 1024;
  if (sizeStr.includes('KB')) return size * 1024;
  return size;
}

function parseDate(dateStr: string): number {
  const [day, month, year] = dateStr.split('.');
  return new Date(
    2000 + Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10)
  ).getTime();
}

interface FileDetailContentProps {
  currentPath: string;
  selectedItem: FileItem;
}

function FileDetailContent({ selectedItem: fileItem, currentPath }: FileDetailContentProps) {
  return (
    <div className="space-y-6 px-4">
      <div className="flex flex-col items-center space-y-8 py-4">
        <div className="flex items-center">
          <div className="scale-[3]">{getFileIcon(fileItem.icon)}</div>
        </div>
        <h2 className="text-foreground text-center">{fileItem.name}</h2>
      </div>

      <div>
        <h3 className="text-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
          Info
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground text-sm">Type</span>
            <span className="text-foreground text-sm capitalize">{fileItem.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-sm">Size</span>
            <span className="text-foreground text-sm">{fileItem.size}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-sm">Owner</span>
            <span className="text-foreground text-sm">ArtTemplate</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-sm">Location</span>
            <span className="text-sm">{currentPath ? `My Files/${currentPath}` : 'My Files'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-sm">Modified</span>
            <span className="text-foreground text-sm">Sep 17, 2020 4:25</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-sm">Created</span>
            <span className="text-foreground text-sm">Sep 10, 2020 2:25</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
          Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">File Sharing</span>
            <Switch checked />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Backup</span>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Sync</span>
            <Switch />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FileManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const currentPath = searchParams.get('path') || '';
  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const isMobile = useIsMobile();

  const sortItems = (items: FileItem[]): FileItem[] =>
    [...items].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name': {
          comparison = a.name.localeCompare(b.name);
          break;
        }
        case 'date': {
          comparison = parseDate(a.date) - parseDate(b.date);
          break;
        }
        case 'size': {
          comparison = parseFileSize(a.size) - parseFileSize(b.size);
          break;
        }
        default: {
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const getCurrentFolderItems = () => {
    if (!currentPath) {
      return allFileItems.filter((item) => !item.parentPath);
    }

    const parentFolder = allFileItems.find(
      (item) => item.name === pathSegments[pathSegments.length - 1]
    );
    return parentFolder?.children || [];
  };

  const currentItems = getCurrentFolderItems();
  const filteredItems = currentItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const sortedAndFilteredItems = sortItems(filteredItems);

  useEffect(() => {
    setSelectedItem(null);
    setShowMobileDetails(false);
  }, [currentPath]);

  const handleSortChange = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('asc');
    }
  };

  const getSortLabel = () => {
    const directionIcon = sortDirection === 'asc' ? '↑' : '↓';
    switch (sortBy) {
      case 'name': {
        return `Name ${directionIcon}`;
      }
      case 'date': {
        return `Date ${directionIcon}`;
      }
      case 'size': {
        return `Size ${directionIcon}`;
      }
      default: {
        return `Name ${directionIcon}`;
      }
    }
  };

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'folder') {
      const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      router.push(`?path=${encodeURIComponent(newPath)}`);
    } else {
      setSelectedItem(item);
      setShowMobileDetails(true);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      router.push('/dashboard/apps/file-manager');
    } else {
      const newPath = pathSegments.slice(0, index + 1).join('/');
      router.push(`?path=${encodeURIComponent(newPath)}`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === sortedAndFilteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(sortedAndFilteredItems.map((item) => item.id)));
    }
  };

  const toggleItemSelection = (itemId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(itemId)) {
      newSelectedItems.delete(itemId);
    } else {
      newSelectedItems.add(itemId);
    }
    setSelectedItems(newSelectedItems);
  };

  return (
    <div className="flex">
      <div className="border-border min-w-0 flex-1 space-y-4">
        {/* Breadcrumb Navigation */}
        <div className="flex justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Files</h1>
            {pathSegments.length > 0 && (
              <>
                <Separator
                  className="mx-2 data-[orientation=vertical]:h-4"
                  orientation="vertical"
                />
                <div className="border-border/50 bg-muted/20 flex items-center overflow-x-auto">
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem
                        className="cursor-pointer"
                        onClick={() => handleBreadcrumbClick(-1)}
                      >
                        <Home className="h-4 w-4" />
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      {pathSegments.map((segment, segmentIndex) => (
                        <React.Fragment key={`path-${segment}`}>
                          <BreadcrumbItem
                            className="cursor-pointer"
                            onClick={() => handleBreadcrumbClick(segmentIndex)}
                          >
                            {segment}
                          </BreadcrumbItem>
                          {segmentIndex < pathSegments.length - 1 && <BreadcrumbSeparator />}
                        </React.Fragment>
                      ))}
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              </>
            )}
          </div>

          <div className="border-border flex items-center justify-between gap-2">
            <FileUploadDialog />
          </div>
        </div>

        <div className="flex border-t">
          {/* File List */}
          <div className="min-w-0 grow">
            <div className="flex items-center justify-between border-b p-2 pe-1! lg:p-4">
              <div className="flex grow items-center gap-2">
                <Checkbox
                  checked={
                    selectedItems.size === sortedAndFilteredItems.length &&
                    sortedAndFilteredItems.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                />
                {selectedItems.size > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <ChevronDownIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem>Compress</DropdownMenuItem>
                      <DropdownMenuItem>Archive</DropdownMenuItem>
                      <DropdownMenuItem>Share</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Move</DropdownMenuItem>
                      <DropdownMenuItem>Copy</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600!">Send to Trash</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Input
                    className="bg-background w-full border-0 shadow-none focus:ring-0!"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for files and folders..."
                    value={searchQuery}
                  />
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost">Sort: {getSortLabel()}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSortChange('name')}>
                    <div className="flex w-full items-center justify-between">
                      <span>Name</span>
                      {sortBy === 'name' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('date')}>
                    <div className="flex w-full items-center justify-between">
                      <span>Date</span>
                      {sortBy === 'date' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('size')}>
                    <div className="flex w-full items-center justify-between">
                      <span>Size</span>
                      {sortBy === 'size' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {sortedAndFilteredItems.map((item) => (
              <div
                className={cn(
                  'hover:bg-muted flex cursor-pointer items-center justify-between border-b p-2 lg:p-4',
                  selectedItem?.id === item.id && 'bg-muted'
                )}
                key={item.id}
                onClick={() => handleItemClick(item)}
              >
                <div className="flex min-w-0 items-center space-x-4">
                  <Checkbox
                    checked={selectedItems.has(item.id)}
                    defaultChecked={selectedItem?.id === item.id}
                    onClick={(e) => toggleItemSelection(item.id, e)}
                  />
                  <div className="shrink-0">{getFileIcon(item.icon)}</div>
                  <div className="min-w-0 truncate">{item.name}</div>
                </div>

                <div className="text-muted-foreground flex items-center space-x-4 text-sm">
                  <span className="hidden w-16 text-right lg:inline">{item.date}</span>
                  <span className="hidden w-16 text-right lg:inline">{item.size}</span>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={item.owner.avatar || '/placeholder.svg'} />
                    <AvatarFallback className="text-xs">{item.owner.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Compress</DropdownMenuItem>
                      <DropdownMenuItem>Archive</DropdownMenuItem>
                      <DropdownMenuItem>Share</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Move</DropdownMenuItem>
                      <DropdownMenuItem>Copy</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600!">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}

            {sortedAndFilteredItems.length === 0 && searchQuery && (
              <div className="text-muted-foreground flex items-center justify-center p-8 text-center">
                No files or folders found matching &#34;{searchQuery}&#34;
              </div>
            )}

            {sortedAndFilteredItems.length === 0 && !searchQuery && currentPath && (
              <div className="flex h-[calc(100vh-var(--header-height)-3rem)] flex-col items-center justify-center">
                <div className="mx-auto max-w-md space-y-4 text-center">
                  <FolderPlus className="mx-auto size-14 opacity-50" />
                  <h2 className="text-muted-foreground">This folder is empty.</h2>
                  <div>
                    <Button>
                      <UploadIcon />
                      Upload
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {pathSegments.length === 0 && (
              <div className="mt-4">
                <FileManagerPagination />
              </div>
            )}
          </div>

          {/* Desktop Right Panel - Details */}
          {selectedItem && !isMobile ? (
            <div className="relative w-80 border-s py-6">
              <Button
                className="absolute top-2 right-0"
                onClick={() => setSelectedItem(null)}
                size="icon"
                variant="ghost"
              >
                <XIcon />
              </Button>
              <FileDetailContent currentPath={currentPath} selectedItem={selectedItem} />
            </div>
          ) : null}
        </div>
      </div>

      {selectedItem && isMobile && (
        <Sheet onOpenChange={setShowMobileDetails} open={showMobileDetails}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>File Details</SheetTitle>
            </SheetHeader>
            <FileDetailContent currentPath={currentPath} selectedItem={selectedItem} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
