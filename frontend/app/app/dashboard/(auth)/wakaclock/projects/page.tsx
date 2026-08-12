'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BreakdownChart } from '@/components/wakaclock/breakdown-chart';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { cn } from '@/lib/utils';
import { getProjects } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { ProjectItem } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

type SortKey = 'heartbeats' | 'name' | 'total_seconds';

function SortHeader({
  active,
  columnKey,
  desc,
  label,
  onSort,
}: {
  active: boolean;
  columnKey: SortKey;
  desc: boolean;
  label: string;
  onSort: (key: SortKey) => void;
}) {
  return (
    <TableHead
      className="hover:text-foreground cursor-pointer select-none"
      onClick={() => onSort(columnKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active &&
          (desc ? <ArrowDownIcon className="size-3" /> : <ArrowUpIcon className="size-3" />)}
      </span>
    </TableHead>
  );
}

function ProjectsTable() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(30);
  const [sortKey, setSortKey] = React.useState<SortKey>('total_seconds');
  const [sortDesc, setSortDesc] = React.useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.projects(userId, start, end),
    queryFn: () => getProjects(userId, start, end),
    enabled: Boolean(userId),
  });

  const rows = [...(data?.data ?? [])].sort((a, b) => {
    const dir = sortDesc ? -1 : 1;
    if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
    return (a[sortKey] - b[sortKey]) * dir;
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              GET /projects — the only endpoint that applies project_merges
            </CardDescription>
          </div>
          <RangePicker onChange={setRange} value={{ start, end }} />
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          error={error}
          isEmpty={!isLoading && !error && rows.length === 0}
          isLoading={isLoading}
        >
          <div className="space-y-6">
            <BreakdownChart data={rows} />
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader
                      active={sortKey === 'name'}
                      columnKey="name"
                      desc={sortDesc}
                      label="Project"
                      onSort={toggleSort}
                    />
                    <SortHeader
                      active={sortKey === 'total_seconds'}
                      columnKey="total_seconds"
                      desc={sortDesc}
                      label="Total"
                      onSort={toggleSort}
                    />
                    <SortHeader
                      active={sortKey === 'heartbeats'}
                      columnKey="heartbeats"
                      desc={sortDesc}
                      label="Heartbeats"
                      onSort={toggleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((project: ProjectItem) => (
                    <TableRow key={project.name}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className={cn('font-mono text-xs')}>{project.text}</TableCell>
                      <TableCell>{project.heartbeats.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
}

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Merged project totals for the selected range. Manage merges in Settings."
        title="Projects"
      />
      <RequireUser>
        <ProjectsTable />
      </RequireUser>
    </div>
  );
}
