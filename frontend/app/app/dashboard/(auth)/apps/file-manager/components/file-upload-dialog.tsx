'use client';

import * as React from 'react';

import { Upload, UploadIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function FileUploadDialog() {
  const [open, setOpen] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragActive, setDragActive] = React.useState(false);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    setFiles((prevFiles) => [...prevFiles, ...fileList]);
  };

  const removeFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    setOpen(false);
    setFiles([]);
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button onClick={() => setOpen(true)}>
        <UploadIcon />
        Upload
      </Button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>Drag and drop files here or click to select files</DialogDescription>
        </DialogHeader>
        <div
          className={`mt-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10 ${
            dragActive ? 'bg-muted' : ''
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload aria-hidden="true" className="mx-auto size-10 opacity-25" />
            <div className="mt-4 flex text-sm leading-none">
              <Label className="relative cursor-pointer" htmlFor="file-upload">
                <span>Upload a file</span>
                <Input
                  className="sr-only h-auto p-0"
                  id="file-upload"
                  multiple
                  name="file-upload"
                  onChange={handleChange}
                  type="file"
                />
              </Label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-muted-foreground text-xs leading-5">PNG, JPG, GIF up to 10MB</p>
          </div>
        </div>
        {files.length > 0 && (
          <div>
            <h4 className="text-sm">Selected Files</h4>
            <ul className="divide mt-2 divide-y rounded-md border">
              {files.map((file, fileIndex) => (
                <li
                  className="flex items-center justify-between py-2 pr-2 pl-4 text-sm leading-6"
                  key={`${file.name}-${file.lastModified}-${file.size}`}
                >
                  <div className="flex w-0 flex-1 items-center">
                    <div className="flex min-w-0 flex-1 gap-2">
                      <span className="truncate font-medium">{file.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {(file.size / 1024).toFixed(2)} kb
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button onClick={() => removeFile(fileIndex)} size="icon" variant="ghost">
                      <XIcon />
                      <span className="sr-only">Remove file</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={files.length === 0} onClick={handleUpload}>
            Start Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
