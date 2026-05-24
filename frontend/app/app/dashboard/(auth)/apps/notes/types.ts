export type Note = {
  content?: string;
  id: number;
  image?: string;
  isArchived: boolean;
  items?: { checked: boolean; text: string }[];
  labels: number[];
  title: string;
  type: 'checklist' | 'image' | 'text';
};

export type NoteLabel = {
  color: string;
  id: number;
  title: string;
};
