import React from 'react';

import { format } from 'date-fns';
import {
  Check,
  ClockIcon,
  Edit,
  FileIcon,
  FilePlus,
  PlusCircleIcon,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { priorityClasses, statusClasses } from '@/app/dashboard/(auth)/apps/todo-list-app/enum';
import { useTodoStore } from '@/app/dashboard/(auth)/apps/todo-list-app/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

interface TodoDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onEditClick?: (id: string) => void;
  todoId: null | string;
}

const TodoDetailSheet: React.FC<TodoDetailSheetProps> = ({
  isOpen,
  onClose,
  todoId,
  onEditClick,
}) => {
  const {
    todos,
    addComment,
    deleteComment,
    addFile,
    removeFile,
    addSubTask,
    updateSubTask,
    removeSubTask,
  } = useTodoStore();

  const [newComment, setNewComment] = React.useState('');
  const [newSubTask, setNewSubTask] = React.useState('');
  const [isAddingSubTask, setIsAddingSubTask] = React.useState(false);

  const todo = todos.find((t) => t.id === todoId);

  if (!todo) return null;

  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast.error('Both comment and author name are required');
      return;
    }

    addComment(todo.id, newComment);
    setNewComment('');
    toast.success('Your comment has been added successfully.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (!files || files.length === 0) return;

    [...files].forEach((file) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.addEventListener('load', () => {
        addFile(todo.id, {
          name: file.name,
          url: reader.result as string,
          type: file.type,
          size: file.size,
          uploadedAt: new Date(),
        });

        toast.success(`${file.name} has been added to the task`);
      });
    });

    e.target.value = '';
  };

  const handleAddSubTask = () => {
    if (!newSubTask.trim()) {
      toast.error('Subtask title is required');
      return;
    }

    addSubTask(todo.id, newSubTask);
    setNewSubTask('');
    setIsAddingSubTask(false);
    toast.success('Your subtask has been added successfully.');
  };

  const handleSubTaskToggle = (subTaskId: string, completed: boolean) => {
    updateSubTask(todo.id, subTaskId, completed);
  };

  const handleRemoveSubTask = (subTaskId: string) => {
    removeSubTask(todo.id, subTaskId);
    toast.success('The subtask has been removed successfully.');
  };

  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-start justify-between pe-6">
            <SheetTitle>{todo.title}</SheetTitle>
            {onEditClick && (
              <Button onClick={() => onEditClick(todo.id)} variant="outline">
                <Edit />
                Edit
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 capitalize">
            <Badge className={statusClasses[todo.status]}>{todo.status.replace('-', ' ')}</Badge>
            <Badge className={priorityClasses[todo.priority]}>{todo.priority}</Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6 p-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Description</h4>
            <p className="text-muted-foreground text-sm">
              {todo.description || 'No description provided.'}
            </p>
          </div>

          <div className="grid grid-cols-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Assigned To</h4>
              <p className="text-muted-foreground text-sm">{todo.assignedTo || 'Unassigned'}</p>
            </div>
            {todo.dueDate && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Due Date</h4>
                <p className="text-muted-foreground text-sm">
                  {format(new Date(todo.dueDate), 'PPP')}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Created</h4>
              <p className="text-muted-foreground text-sm">
                {format(new Date(todo.createdAt), 'PPP')}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4 p-4">
          <h4 className="text-sm font-medium">Subtasks</h4>
          {todo.subTasks && todo.subTasks.length > 0 ? (
            <div className="space-y-2">
              {todo.subTasks.map((subTask) => (
                <div
                  className="bg-muted flex items-center justify-between rounded-md p-2"
                  key={subTask.id}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={subTask.completed}
                      onCheckedChange={(checked) =>
                        handleSubTaskToggle(subTask.id, Boolean(checked))
                      }
                    />
                    <span
                      className={cn(
                        'text-sm',
                        subTask.completed && 'text-muted-foreground line-through'
                      )}
                    >
                      {subTask.title}
                    </span>
                  </div>
                  <Button
                    className="text-red-400!"
                    onClick={() => handleRemoveSubTask(subTask.id)}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-muted text-muted-foreground rounded-md p-4 text-center text-sm">
              No subtasks yet.
            </div>
          )}

          {!isAddingSubTask && (
            <div>
              <Button onClick={() => setIsAddingSubTask(true)} size="sm" variant="outline">
                <PlusCircleIcon />
                <span>Add Sub Task</span>
              </Button>
            </div>
          )}

          {isAddingSubTask && (
            <div className="flex gap-2">
              <Input
                className="flex-1"
                onChange={(e) => setNewSubTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddSubTask();
                  } else if (e.key === 'Escape') {
                    setIsAddingSubTask(false);
                    setNewSubTask('');
                  }
                }}
                placeholder="Enter subtask title"
                value={newSubTask}
              />
              <Button onClick={handleAddSubTask}>
                <Check />
              </Button>
              <Button
                onClick={() => {
                  setIsAddingSubTask(false);
                  setNewSubTask('');
                }}
                variant="destructive"
              >
                <X />
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Attachments</h4>
            <div>
              <input
                className="sr-only"
                id="file-upload"
                multiple
                onChange={handleFileUpload}
                type="file"
              />
              <label htmlFor="file-upload">
                <span className="sr-only">Upload file</span>
                <Button asChild size="sm" variant="outline">
                  <span>
                    <FilePlus />
                    Upload
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {todo.files && todo.files.length > 0 ? (
            <div className="space-y-2">
              {todo.files.map((file) => (
                <div
                  className="bg-muted flex items-center justify-between rounded-md p-2"
                  key={file.id}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileIcon className="h-4 w-4 shrink-0" />
                    <div className="overflow-hidden">
                      <Link
                        className="block truncate text-sm hover:underline"
                        href={file.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {file.name}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {formatFileSize(file.size)} •{' '}
                        {format(new Date(file.uploadedAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <Button
                    className="text-red-400!"
                    onClick={() => removeFile(todo.id, file.id)}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-muted text-muted-foreground rounded-md p-4 text-center text-sm">
              No files attached.
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4 p-4">
          <h4 className="text-sm font-medium">Comments ({todo.comments.length})</h4>

          {todo.comments.length === 0 && (
            <div className="bg-muted text-muted-foreground rounded-md p-4 text-center text-sm">
              No comments yet.
            </div>
          )}

          <div className="space-y-2">
            {todo.comments.map((comment) => (
              <div className="bg-muted group relative space-y-3 rounded-md p-3" key={comment.id}>
                <p className="text-sm">{comment.text}</p>
                <div className="text-muted-foreground flex justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="size-3" /> {format(new Date(comment.createdAt), 'PPp')}
                  </div>
                  <div className="absolute end-2 bottom-2 flex items-center opacity-0 group-hover:opacity-100">
                    <Button
                      className="text-red-400!"
                      onClick={() => deleteComment(todo.id, comment.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Textarea
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write your comment..."
              value={newComment}
            />
            <Button onClick={handleAddComment}>Add Comment</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TodoDetailSheet;
