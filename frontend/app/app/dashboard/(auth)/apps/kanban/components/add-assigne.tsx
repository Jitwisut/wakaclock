import * as React from 'react';

import { Check, UserPlusIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const users = [
  {
    name: 'Olivia Martin',
    email: 'm@example.com',
    avatar: `/images/avatars/01.png`,
  },
  {
    name: 'Isabella Nguyen',
    email: 'isabella.nguyen@email.com',
    avatar: `/images/avatars/07.png`,
  },
  {
    name: 'Emma Wilson',
    email: 'emma@example.com',
    avatar: `/images/avatars/02.png`,
  },
  {
    name: 'Jackson Lee',
    email: 'lee@example.com',
    avatar: `/images/avatars/09.png`,
  },
  {
    name: 'William Kim',
    email: 'will@email.com',
    avatar: `/images/avatars/06.png`,
  },
] as const;

type User = (typeof users)[number];

export default function AddAssigne() {
  const [open, setOpen] = React.useState(false);
  const [selectedUsers, setSelectedUsers] = React.useState<User[]>([]);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlusIcon />
          <span className="hidden lg:inline">Add Assigne</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 outline-hidden">
        <DialogHeader className="px-4 pt-5 pb-4">
          <DialogTitle>Assign Users</DialogTitle>
        </DialogHeader>
        <Command className="overflow-hidden rounded-t-none border-t">
          <CommandInput placeholder="Search user..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup className="p-2">
              {users.map((user) => (
                <CommandItem
                  className="flex items-center p-2"
                  key={user.email}
                  onSelect={() => {
                    if (selectedUsers.includes(user)) {
                      return setSelectedUsers(
                        selectedUsers.filter((selectedUser) => selectedUser !== user)
                      );
                    }

                    return setSelectedUsers(
                      [...users].filter((u) => [...selectedUsers, user].includes(u))
                    );
                  }}
                >
                  <Avatar>
                    <AvatarImage alt="Image" src={user.avatar} />
                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="ml-2">
                    <p className="text-sm leading-none font-medium">{user.name}</p>
                    <p className="text-muted-foreground text-sm">{user.email}</p>
                  </div>
                  {selectedUsers.includes(user) ? (
                    <Check className="text-primary ml-auto flex h-5 w-5" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter className="flex items-center border-t p-4 sm:justify-between">
          {selectedUsers.length > 0 ? (
            <div className="flex -space-x-2 overflow-hidden">
              {selectedUsers.map((user) => (
                <Avatar className="border-background inline-block border-2" key={user.email}>
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Select the users to add to this role.</p>
          )}
          <Button
            disabled={selectedUsers.length === 0}
            onClick={() => {
              setOpen(false);
            }}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
