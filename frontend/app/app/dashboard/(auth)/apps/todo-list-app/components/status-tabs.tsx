import React from 'react';

import { EnumTodoStatus, todoStatusNamed } from '@/app/dashboard/(auth)/apps/todo-list-app/enum';
import type { FilterTab } from '@/app/dashboard/(auth)/apps/todo-list-app/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StatusTabsProps {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
}

const StatusTabs: React.FC<StatusTabsProps> = ({ onTabChange, activeTab }) => (
  <Tabs
    defaultValue={activeTab}
    onValueChange={(value) => onTabChange(value as FilterTab)}
    value={activeTab}
  >
    <TabsList>
      <TabsTrigger value="all">All</TabsTrigger>
      {Object.values(EnumTodoStatus).map((status) => (
        <TabsTrigger key={status} value={status}>
          {todoStatusNamed[status]}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);

export default StatusTabs;
