'use client';

import React from 'react';

import { PlusCircleIcon } from 'lucide-react';

import { DateTimePicker } from '@/components/date-time-picker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Priority = 'high' | 'low' | 'medium';

type Reminder = {
  category: string;
  date: string;
  id: number;
  priority: Priority;
  text: string;
  time: string;
};

export function AddReminderDialog() {
  const [date, setDate] = React.useState<Date>();
  const [reminders, setReminders] = React.useState<Reminder[]>([
    {
      id: 1,
      priority: 'low',
      date: 'Today',
      time: '12:30',
      text: 'Create a design training for beginners.',
      category: 'Design Education',
    },
    {
      id: 2,
      priority: 'medium',
      date: 'Today',
      time: '10:00',
      text: 'Have a meeting with the new design team.',
      category: 'Meeting',
    },
    {
      id: 3,
      priority: 'high',
      date: 'Tomorrow',
      time: '16:30',
      text: 'Respond to customer support emails.',
      category: 'Customer Support',
    },
  ]);

  const [open, setOpen] = React.useState(false);
  const [newReminder, setNewReminder] = React.useState<Omit<Reminder, 'id'>>({
    priority: 'medium',
    date: '',
    time: '',
    text: '',
    category: '',
  });

  const handleAddReminder = () => {
    const reminder: Reminder = {
      ...newReminder,
      id: reminders.length + 1,
    };

    setReminders([...reminders, reminder]);
    setNewReminder({
      priority: 'medium',
      date: '',
      time: '',
      text: '',
      category: '',
    });
    setOpen(false);
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusCircleIcon />
          Set Reminder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Reminder</DialogTitle>
        </DialogHeader>
        <div className="mt-4 grid space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="text">Note</Label>
            <Input
              id="text"
              onChange={(e) => setNewReminder({ ...newReminder, text: e.target.value })}
              placeholder="Enter your reminder"
              value={newReminder.text}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="text">Date</Label>
            <DateTimePicker date={date} setDate={setDate} />
          </div>

          <div className="grid gap-3">
            <Label>Priority</Label>
            <RadioGroup
              className="flex space-x-4"
              onValueChange={(value) =>
                setNewReminder({ ...newReminder, priority: value as Priority })
              }
              value={newReminder.priority}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="low" value="low" />
                <Label className="cursor-pointer" htmlFor="low">
                  Low
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="medium" value="medium" />
                <Label className="cursor-pointer" htmlFor="medium">
                  Medium
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="high" value="high" />
                <Label className="cursor-pointer" htmlFor="high">
                  High
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              onValueChange={(value) => setNewReminder({ ...newReminder, category: value })}
              value={newReminder.category}
            >
              <SelectTrigger className="w-full" id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Meeting">Meeting</SelectItem>
                <SelectItem value="Design Education">Design Education</SelectItem>
                <SelectItem value="Customer Support">Customer Support</SelectItem>
                <SelectItem value="Personal">Personal</SelectItem>
                <SelectItem value="Work">Work</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleAddReminder}>Add Reminder</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
