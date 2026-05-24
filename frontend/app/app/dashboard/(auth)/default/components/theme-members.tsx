'use client';

import React from 'react';

import { Check, ChevronsDownIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const roles = [
  {
    id: 1,
    name: 'Viewer',
    description: 'Can view and comment.',
  },
  {
    id: 2,
    name: 'Developer',
    description: 'Can view, comment and edit.',
  },
  {
    id: 3,
    name: 'Billing',
    description: 'Can view, comment and manage billing.',
  },
  {
    id: 4,
    name: 'Owner',
    description: 'Admin-level access to all resources.',
  },
];

const members = [
  {
    id: 1,
    name: 'Toby Belhome',
    email: 'contact@bundui.io',
    avatar: `/images/avatars/01.png`,
    role_id: 1,
  },
  {
    id: 2,
    name: 'Jackson Lee',
    email: 'pre@example.com',
    avatar: `/images/avatars/02.png`,
    role_id: 2,
  },
  {
    id: 3,
    name: 'Hally Gray',
    email: 'hally@site.com',
    avatar: `/images/avatars/03.png`,
    role_id: 1,
  },
];

export function TeamMembersCard() {
  const [data, setData] = React.useState(members);
  const [openIndex, setOpenIndex] = React.useState<null | number>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>Invite your team members to collaborate.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {data.map((member) => (
          <div className="flex items-center justify-between space-x-4" key={member.id}>
            <div className="flex items-center space-x-4">
              <Avatar>
                <AvatarImage src={member.avatar} />
                <AvatarFallback>OM</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm leading-none font-medium">{member.name}</p>
                <p className="text-muted-foreground text-sm">{member.email}</p>
              </div>
            </div>
            <Popover
              onOpenChange={(isOpen) => setOpenIndex(isOpen ? member.id : null)}
              open={openIndex === member.id}
            >
              <PopoverTrigger asChild>
                <Button className="ml-auto" variant="outline">
                  {roles.find((role) => role.id === member.role_id)?.name}{' '}
                  <ChevronsDownIcon className="text-muted-foreground ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="p-0">
                <Command>
                  <CommandInput placeholder="Select new role..." />
                  <CommandList>
                    <CommandEmpty>No roles found.</CommandEmpty>
                    <CommandGroup>
                      {roles.map((role) => (
                        <CommandItem
                          className="teamaspace-y-1 flex items-start px-4 py-2"
                          key={role.id}
                          onSelect={() => {
                            setData((prevData) =>
                              prevData.map((m) =>
                                m.id === member.id ? { ...m, role_id: role.id } : m
                              )
                            );
                            setOpenIndex(null);
                          }}
                        >
                          <div>
                            <p>{role.name}</p>
                            <p className="text-muted-foreground text-sm">{role.description}</p>
                          </div>
                          {member.role_id === role.id ? (
                            <Check className="text-primary ml-auto flex size-4" />
                          ) : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
