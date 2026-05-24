import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  EnumTodoPriority,
  EnumTodoStatus,
  priorityDotColors,
  statusDotColors,
  todoStatusNamed,
} from '@/app/dashboard/(auth)/apps/todo-list-app/enum';
import { todoFormSchema } from '@/app/dashboard/(auth)/apps/todo-list-app/schemas';
import type { TodoFormValues } from '@/app/dashboard/(auth)/apps/todo-list-app/schemas';
import { useTodoStore } from '@/app/dashboard/(auth)/apps/todo-list-app/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface AddTodoSheetProps {
  editTodoId?: null | string;
  isOpen: boolean;
  onClose: () => void;
}

const AddTodoSheet: React.FC<AddTodoSheetProps> = ({ isOpen, onClose, editTodoId }) => {
  const { addTodo, updateTodo, todos } = useTodoStore();

  const [assignedUsers, setAssignedUsers] = React.useState<string[]>([]);
  const [newUser, setNewUser] = React.useState('');

  const defaultValues = React.useMemo(
    () => ({
      title: '',
      description: '',
      assignedTo: [] as string[],
      status: EnumTodoStatus.Pending,
      priority: EnumTodoPriority.Medium,
      dueDate: undefined,
      reminderDate: undefined,
    }),
    []
  );

  const form = useForm<TodoFormValues>({
    resolver: zodResolver(todoFormSchema),
    defaultValues,
  });

  // If editTodoId is provided, load that todos data
  React.useEffect(() => {
    if (editTodoId) {
      const todoToEdit = todos.find((todo) => todo.id === editTodoId);
      if (todoToEdit) {
        form.reset({
          title: todoToEdit.title,
          description: todoToEdit.description,
          assignedTo: todoToEdit.assignedTo,
          status: todoToEdit.status as TodoFormValues['status'],
          priority: todoToEdit.priority as TodoFormValues['priority'],
          dueDate: todoToEdit.dueDate,
          reminderDate: todoToEdit.reminderDate,
        });
        setAssignedUsers(todoToEdit.assignedTo);
      }
    } else {
      form.reset(defaultValues);
      setAssignedUsers([]);
    }
  }, [editTodoId, todos, isOpen, form, defaultValues]);

  const onSubmit = (data: TodoFormValues) => {
    // Ensure assignedTo is updated with the latest assignedUsers state
    data.assignedTo = assignedUsers;

    if (editTodoId) {
      updateTodo(editTodoId, data);
      toast.success('Your to-do has been updated successfully.');
    } else {
      addTodo(data);
      toast.success('Your new to-do has been added successfully.');
    }

    form.reset();
    setAssignedUsers([]);
    setNewUser('');
    onClose();
  };

  const addAssignedUser = () => {
    if (newUser.trim() && !assignedUsers.includes(newUser.trim())) {
      const updatedUsers = [...assignedUsers, newUser.trim()];
      setAssignedUsers(updatedUsers);
      form.setValue('assignedTo', updatedUsers);
      setNewUser('');
    }
  };

  const removeAssignedUser = (user: string) => {
    const updatedUsers = assignedUsers.filter((u) => u !== user);
    setAssignedUsers(updatedUsers);
    form.setValue('assignedTo', updatedUsers);
  };

  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editTodoId ? 'Edit To-Do' : 'Add New To-Do'}</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form className="space-y-6 p-4 pt-0" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter description"
                      rows={4}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Assigned To</FormLabel>
              <div className="flex flex-wrap items-center gap-2">
                {assignedUsers.map((user) => (
                  <Badge
                    className="cursor-pointer"
                    key={user}
                    onClick={() => removeAssignedUser(user)}
                    variant="outline"
                  >
                    {user}
                    <X className="size-3" />
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  onChange={(e) => setNewUser(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAssignedUser();
                    }
                  }}
                  placeholder="Enter user name"
                  value={newUser}
                />
                <Button onClick={addAssignedUser} size="icon" type="button" variant="outline">
                  <Plus />
                </Button>
              </div>
              {form.formState.errors.assignedTo && (
                <p className="text-destructive mt-1 text-sm font-medium">
                  {form.formState.errors.assignedTo.message}
                </p>
              )}
            </FormItem>

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          variant="outline"
                        >
                          <CalendarIcon />
                          {field.value ? format(field.value, 'PPP') : 'Select a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          disabled={{ before: new Date() }}
                          mode="single"
                          onSelect={field.onChange}
                          selected={field.value || undefined}
                        />
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reminderDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reminder Date</FormLabel>
                  <FormControl>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          variant="outline"
                        >
                          <CalendarIcon />
                          {field.value ? format(field.value, 'PPP') : 'Select a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          disabled={{ before: new Date() }}
                          mode="single"
                          onSelect={field.onChange}
                          selected={field.value || undefined}
                        />
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(EnumTodoStatus).map((status) => (
                            <SelectItem key={status} value={status}>
                              <span
                                className={cn('size-2 rounded-full', statusDotColors[status])}
                              />
                              {todoStatusNamed[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full capitalize">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(EnumTodoPriority).map((priority) => (
                            <SelectItem className="capitalize" key={priority} value={priority}>
                              <span
                                className={cn('size-2 rounded-full', priorityDotColors[priority])}
                              />
                              {priority}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button className="w-full" type="submit">
              {editTodoId ? 'Save Changes' : 'Add To-Do'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default AddTodoSheet;
