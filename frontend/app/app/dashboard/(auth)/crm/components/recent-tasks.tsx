'use client';

import { useState } from 'react';

import { PlusCircleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type Task = {
  completed: boolean;
  description: string;
  dueDate: string;
  id: string;
  priority: 'high' | 'low' | 'medium';
  title: string;
};

const initialTasks: Task[] = [
  {
    id: '1',
    title: 'Follow up with Acme Inc.',
    description: 'Send proposal and schedule meeting',
    completed: false,
    dueDate: 'Today',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Prepare quarterly report',
    description: 'Compile sales data and forecasts',
    completed: false,
    dueDate: 'Tomorrow',
    priority: 'medium',
  },
  {
    id: '3',
    title: 'Update customer profiles',
    description: 'Verify contact information and preferences',
    completed: true,
    dueDate: 'Oct 15',
    priority: 'low',
  },
];

export function RecentTasks() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleTaskStatus = (id: string) => {
    setTasks(
      tasks.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task))
    );
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardDescription>Track and manage your upcoming tasks.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            <PlusCircleIcon /> Add Task
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task) => (
          <div
            className={cn(
              'flex items-start space-x-3 rounded-md border p-3 transition-colors',
              task.completed && 'bg-muted/50'
            )}
            key={task.id}
          >
            <Checkbox
              checked={task.completed}
              className="mt-1"
              onCheckedChange={() => toggleTaskStatus(task.id)}
            />
            <div className="space-y-1">
              <p
                className={cn(
                  'text-sm leading-none font-medium',
                  task.completed && 'text-muted-foreground line-through'
                )}
              >
                {task.title}
              </p>
              <p className={cn('text-muted-foreground text-xs', task.completed && 'line-through')}>
                {task.description}
              </p>
              <div className="flex items-center pt-1">
                <div
                  className={cn(
                    'mr-2 rounded-full px-2 py-0.5 text-xs font-medium',
                    task.priority === 'high' && 'bg-red-100 text-red-700',
                    task.priority === 'medium' && 'bg-amber-100 text-amber-700',
                    task.priority === 'low' && 'bg-green-100 text-green-700'
                  )}
                >
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </div>
                <span className="text-muted-foreground text-xs">Due {task.dueDate}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
