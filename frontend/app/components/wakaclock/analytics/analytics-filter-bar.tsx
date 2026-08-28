'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RangePicker } from '@/components/wakaclock/range-picker';
import type {
  AnalyticsFilterOption,
  AnalyticsFilterOptions,
  AnalyticsSourceFilter,
} from '@/lib/wakaclock/analytics';

interface AnalyticsFilterBarProps {
  filters: {
    category?: string;
    editor?: string;
    end: string;
    language?: string;
    operatingSystem?: string;
    projectId?: string;
    source?: AnalyticsSourceFilter;
    start: string;
  };
  lockedProjectId?: string;
  onReset: () => void;
  onSetFilter: (
    name: 'category' | 'editor' | 'language' | 'operating_system' | 'project_id' | 'source',
    value?: string
  ) => void;
  onSetRange: (range: { end: string; start: string }) => void;
  options: AnalyticsFilterOptions;
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value?: string) => void;
  options: AnalyticsFilterOption[];
  value?: string;
}) {
  return (
    <label className="flex min-w-36 flex-col gap-1 text-xs font-medium">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="bg-background h-9 rounded-md border px-2 text-sm"
        onChange={(event) => onChange(event.target.value === 'all' ? undefined : event.target.value)}
        value={value ?? 'all'}
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AnalyticsFilterBar({
  filters,
  lockedProjectId,
  onReset,
  onSetFilter,
  onSetRange,
  options,
}: AnalyticsFilterBarProps) {
  const lockedProject = lockedProjectId
    ? options.projects.find((option) => option.key === lockedProjectId)
    : undefined;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">Date range</span>
          <RangePicker onChange={onSetRange} value={{ start: filters.start, end: filters.end }} />
        </div>
        {lockedProjectId ? (
          <div className="flex min-w-36 flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">Project</span>
            <div className="bg-muted flex h-9 items-center rounded-md border px-3 text-sm font-medium">
              {lockedProject?.name ?? 'Selected project'}
            </div>
          </div>
        ) : (
          <FilterSelect
            label="Project"
            onChange={(value) => onSetFilter('project_id', value)}
            options={options.projects}
            value={filters.projectId}
          />
        )}
        <FilterSelect
          label="Language"
          onChange={(value) => onSetFilter('language', value)}
          options={options.languages}
          value={filters.language}
        />
        <FilterSelect
          label="Editor"
          onChange={(value) => onSetFilter('editor', value)}
          options={options.editors}
          value={filters.editor}
        />
        <FilterSelect
          label="Category"
          onChange={(value) => onSetFilter('category', value)}
          options={options.categories}
          value={filters.category}
        />
        <label className="flex min-w-32 flex-col gap-1 text-xs font-medium">
          <span className="text-muted-foreground">Source</span>
          <select
            className="bg-background h-9 rounded-md border px-2 text-sm"
            onChange={(event) =>
              onSetFilter('source', event.target.value === 'all' ? undefined : event.target.value)
            }
            value={filters.source ?? 'all'}
          >
            <option value="all">Human + AI + Other</option>
            <option value="human">Human</option>
            <option value="ai">AI</option>
            <option value="other">Other / handover</option>
          </select>
        </label>
        <FilterSelect
          label="Operating system"
          onChange={(value) => onSetFilter('operating_system', value)}
          options={options.operating_systems}
          value={filters.operatingSystem}
        />
        <Button className="ml-auto" onClick={onReset} type="button" variant="outline">
          Reset filters
        </Button>
      </CardContent>
    </Card>
  );
}
