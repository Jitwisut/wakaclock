'use client';

import React from 'react';

import { Dribbble, Facebook, FileText, Instagram, Linkedin, SheetIcon, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import type { UserPropsTypes } from '@/app/dashboard/(auth)/apps/chat/types';
import useChatStore from '@/app/dashboard/(auth)/apps/chat/use-chat-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { generateAvatarFallback } from '@/lib/utils';

export function UserDetailSheet({ user }: { user: UserPropsTypes }) {
  const { showProfileSheet, toggleProfileSheet } = useChatStore();

  return (
    <Sheet onOpenChange={toggleProfileSheet} open={showProfileSheet}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-2xl">Profile</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto px-4">
          <div className="my-4 flex flex-col items-center justify-end">
            <Avatar className="mb-4 size-32">
              <AvatarImage alt="avatar image" src={user.avatar} />
              <AvatarFallback>{generateAvatarFallback(user.name)}</AvatarFallback>
            </Avatar>
            <h4 className="mb-2 text-xl font-semibold">{user.name}</h4>
            <div className="text-xs">
              Last seen:{' '}
              {user.online_status === 'success' ? (
                <span className="text-green-500">Online</span>
              ) : (
                <span className="text-muted-foreground">{user.last_seen}</span>
              )}
            </div>
          </div>
          <div className="space-y-2 divide-y">
            {user.about && (
              <div className="space-y-3 py-4">
                <h5 className="text-xs font-semibold uppercase">About</h5>
                <div className="text-muted-foreground">{user.about}</div>
              </div>
            )}
            {user.phone && (
              <div className="space-y-3 py-4">
                <h5 className="text-xs font-semibold uppercase">Phone</h5>
                <div className="text-muted-foreground">{user.phone}</div>
              </div>
            )}
            {user.country && (
              <div className="space-y-3 py-4">
                <h5 className="text-xs font-semibold uppercase">Country</h5>
                <div className="text-muted-foreground">{user.country}</div>
              </div>
            )}
            {user.medias?.length && (
              <div className="space-y-3 py-4">
                <h5 className="text-xs font-semibold uppercase">Media</h5>
                <div>
                  <ScrollArea className="w-full">
                    <div className="flex gap-4 *:shrink-0">
                      {user.medias.map((item) => (
                        <React.Fragment key={item.path}>
                          {item.type === 'image' && (
                            <div>
                              <Image
                                alt="shadcn/ui"
                                className="size-20 rounded-lg"
                                height={40}
                                src={`${item.path}`}
                                unoptimized
                                width={40}
                              />
                            </div>
                          )}
                          {item.type === 'pdf' && (
                            <div>
                              <Link
                                className="flex aspect-square w-20 items-center justify-center rounded-lg bg-green-200"
                                href={item.path ?? '#'}
                              >
                                <SheetIcon className="h-8 w-8 text-green-500" />
                              </Link>
                            </div>
                          )}
                          {item.type === 'file' && (
                            <div>
                              <button
                                className="flex aspect-square w-20 items-center justify-center rounded-lg bg-orange-200"
                                type="button"
                              >
                                <FileText className="h-8 w-8 text-orange-500" />
                              </button>
                            </div>
                          )}
                          {item.type === 'excel' && (
                            <div>
                              <button
                                className="flex aspect-square w-20 items-center justify-center rounded-lg bg-orange-200"
                                type="button"
                              >
                                <FileText className="h-8 w-8 text-orange-500" />
                              </button>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              </div>
            )}
            {user.website && (
              <div className="space-y-3 py-4">
                <h5 className="text-xs font-semibold uppercase">Website</h5>
                <div>
                  <a
                    className="text-muted-foreground hover:text-primary hover:underline"
                    href={user.website}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {user.website}
                  </a>
                </div>
              </div>
            )}
            {user.social_links?.length && (
              <div className="space-y-3 py-4">
                <h5 className="text-xs font-semibold uppercase">Social Links</h5>
                <div className="flex flex-wrap items-center gap-2 *:shrink-0">
                  {user.social_links.map((item) => (
                    <Button
                      asChild
                      className="size-12 rounded-full"
                      key={item.name}
                      size="icon"
                      variant="outline"
                    >
                      <Link
                        className="flex items-center justify-center rounded-full *:h-5 *:w-5"
                        href="#"
                        target="_blank"
                      >
                        {item.name === 'Facebook' && <Facebook />}
                        {item.name === 'X' && <X />}
                        {item.name === 'Dribbble' && <Dribbble />}
                        {item.name === 'Linkedin' && <Linkedin />}
                        {item.name === 'Instagram' && <Instagram />}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
