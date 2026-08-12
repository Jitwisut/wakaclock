import {
  BotIcon,
  DatabaseIcon,
  FolderGit2Icon,
  KeyboardIcon,
  ServerIcon,
  SparklesIcon,
} from 'lucide-react';

const FEATURES = [
  {
    icon: ServerIcon,
    title: 'Self-hosted',
    description:
      'Run it on your own infrastructure. Your heartbeats and code metadata never leave your network unless you choose to.',
  },
  {
    icon: BotIcon,
    title: 'AI attribution in the API',
    description:
      'Heartbeats accept an AI agent name and AI line counts. Whatever your tooling reports under that field is aggregated per agent and per day.',
  },
  {
    icon: SparklesIcon,
    title: 'AI vs. human breakdown',
    description:
      'Lines attributed to an AI agent are counted separately from human keystrokes and characters, so the two can be compared over a date range.',
  },
  {
    icon: KeyboardIcon,
    title: 'Keystroke-level detail',
    description:
      'Keystrokes and characters added or deleted are recorded per project and per day, alongside elapsed time.',
  },
  {
    icon: FolderGit2Icon,
    title: 'Project rules & merges',
    description:
      'Regex-based project detection and manual merges, applied server-side so every client stays in sync automatically.',
  },
  {
    icon: DatabaseIcon,
    title: 'AST-based language detection',
    description:
      'Tree-sitter parsing instead of file-extension guessing — correctly handles ambiguous extensions like .h.',
  },
];

export function FeatureGridSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" id="features">
      <div className="mb-12 text-center">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
        >
          What Azyren tracks
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: 'var(--mkt-fg-muted)' }}>
          Not just elapsed time — which project and language, how the code was written, and
          where the data lives.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            className="rounded-xl border p-6"
            key={feature.title}
            style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-bg-elevated)' }}
          >
            <div
              className="mb-4 inline-flex size-10 items-center justify-center rounded-lg"
              style={{ background: 'var(--mkt-accent-soft)' }}
            >
              <feature.icon aria-hidden className="size-5" style={{ color: 'var(--mkt-accent)' }} />
            </div>
            <h3 className="text-base font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--mkt-fg-muted)' }}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
