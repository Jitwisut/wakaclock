import type { Note, NoteLabel } from '@/app/dashboard/(auth)/apps/notes/types';

export const notes: Note[] = [
  {
    id: 1,
    title: 'Mountain Sunset Photography',
    type: 'image',
    labels: [1, 3],
    isArchived: false,
    image: `/images/extra/image5.jpg`,
    content:
      'Captured this beautiful sunset during our hiking trip. The colors were absolutely stunning!',
  },
  {
    id: 2,
    title: 'Weekly Grocery List',
    type: 'checklist',
    labels: [3, 4],
    isArchived: false,
    items: [
      { text: 'Organic vegetables', checked: true },
      { text: 'Whole grain bread', checked: true },
      { text: 'Greek yogurt', checked: false },
      { text: 'Fresh fruits', checked: false },
      { text: 'Chicken breast', checked: false },
      { text: 'Quinoa', checked: true },
      { text: 'Almond milk', checked: false },
    ],
  },
  {
    id: 3,
    title: 'Project Milestones',
    type: 'text',
    labels: [2],
    isArchived: false,
    content:
      'Q1 Goals:\n- Launch beta version\n- Gather user feedback\n- Implement core features\n- Performance optimization\n- Security audit\n- Documentation update',
  },
  {
    id: 4,
    title: 'Desert Road Trip Ideas',
    type: 'image',
    labels: [3],
    isArchived: false,
    image: `/images/extra/image3.jpg`,
    content:
      'Potential routes for our upcoming desert adventure. Need to plan stops and accommodation.',
  },
  {
    id: 5,
    title: 'Home Renovation Tasks',
    type: 'checklist',
    labels: [2],
    isArchived: false,
    items: [
      { text: 'Paint living room', checked: false },
      { text: 'Replace kitchen faucet', checked: true },
      { text: 'Fix bathroom tiles', checked: false },
      { text: 'Install new light fixtures', checked: false },
    ],
  },
];

export const noteLabels: NoteLabel[] = [
  {
    id: 1,
    title: 'Family',
    color: 'bg-pink-500',
  },
  {
    id: 2,
    title: 'Tasks',
    color: 'bg-purple-500',
  },
  {
    id: 3,
    title: 'Personal',
    color: 'bg-green-500',
  },
  {
    id: 4,
    title: 'Meetings',
    color: 'bg-cyan-500',
  },
  {
    id: 5,
    title: 'Shopping',
    color: 'bg-teal-500',
  },
  {
    id: 6,
    title: 'Planning',
    color: 'bg-orange-500',
  },
  {
    id: 7,
    title: 'Travel',
    color: 'bg-blue-500',
  },
];
