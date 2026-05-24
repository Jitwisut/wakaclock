import { Mic, Paperclip, PlusCircleIcon, SendIcon, SmileIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function ChatFooter() {
  return (
    <div className="lg:px-4">
      <div className="bg-muted relative flex items-center rounded-md border">
        <Input
          className="h-14 border-transparent bg-white pe-32 text-base! shadow-transparent! ring-transparent! lg:pe-56"
          placeholder="Enter message..."
          type="text"
        />
        <div className="absolute end-4 flex items-center">
          <div className="block lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="size-11 rounded-full p-0" variant="ghost">
                  <PlusCircleIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Emoji</DropdownMenuItem>
                <DropdownMenuItem>Add File</DropdownMenuItem>
                <DropdownMenuItem>Send Voice</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="hidden lg:block">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="rounded-full" size="icon" variant="ghost">
                    <SmileIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Emoji</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="rounded-full" size="icon" variant="ghost">
                    <Paperclip />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Select File</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="rounded-full" size="icon" variant="ghost">
                    <Mic />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Send Voice</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button className="ms-3" variant="outline">
            <span className="hidden lg:inline">Send</span> <SendIcon className="inline lg:hidden" />
          </Button>
        </div>
      </div>
    </div>
  );
}
