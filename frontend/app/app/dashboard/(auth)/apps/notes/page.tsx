import NotesApp from '@/app/dashboard/(auth)/apps/notes/note-app';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Note App',
    description:
      'Add, organize and manage notes with the note app template. Built with shadcn/ui, Next.js and Tailwind CSS.',
    canonical: '/apps/notes',
  });
}

export default function Page() {
  return <NotesApp />;
}
