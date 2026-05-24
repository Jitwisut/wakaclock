'use client';

import * as React from 'react';

export interface ActivityItem {
  badge?: { color: string; text: string };
  cards?: Array<{ color: string; id: string }>;
  description: string;
  files?: Array<{ name: string; size: string; type: 'excel' | 'word' }>;
  id: string;
  link?: { id: string; text: string };
  timestamp: string;
  title: string;
  type: 'card-added' | 'file-upload' | 'status-update';
}

export interface Connection {
  avatar?: string;
  connections: number;
  id: string;
  initials?: string;
  name: string;
  online?: boolean;
  status: 'connected' | 'pending';
}

export interface Team {
  id: string;
  members: number;
  name: string;
}

export interface Project {
  hoursSpent: string;
  icon: string;
  iconBg: string;
  id: string;
  name: string;
  progress: number;
  updated: string;
}

interface ProfileState {
  activities: ActivityItem[];
  connections: Connection[];
  profileCompletion: number;
  projects: Project[];
  teams: Team[];
  user: {
    avatar: string;
    department: string;
    email: string;
    joinedDate: string;
    location: string;
    name: string;
    online: boolean;
    phone: string;
    projects: number;
    role: string;
    teams: number;
    verified: boolean;
  };
}

const initialProfileState: ProfileState = {
  user: {
    name: 'Toby Belhome',
    verified: true,
    avatar:
      'https://images.unsplash.com/photo-1654110455429-cf322b40a906?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8YXZhdGFyfGVufDB8fDB8fHww&auto=format&fit=crop&q=60&w=200',
    role: 'Developer',
    location: 'San Francisco, US',
    joinedDate: 'March 2025',
    email: 'hi@shadcnuikit.com',
    phone: '+1 (609) 972-22-22',
    department: 'No department',
    teams: 7,
    projects: 8,
    online: true,
  },
  profileCompletion: 82,
  activities: [],
  connections: [],
  teams: [],
  projects: [],
};

const ProfileStoreContext = React.createContext<ProfileState | undefined>(undefined);

export function ProfileStoreProvider({ children }: { children: React.ReactNode }) {
  const value = React.useMemo(() => initialProfileState, []);

  return React.createElement(ProfileStoreContext.Provider, { value }, children);
}

export function useProfileStore(): ProfileState;
export function useProfileStore<TSelected>(selector: (state: ProfileState) => TSelected): TSelected;
export function useProfileStore<TSelected>(selector?: (state: ProfileState) => TSelected) {
  const store = React.useContext(ProfileStoreContext);
  if (!store) {
    throw new Error('useProfileStore must be used within a ProfileStoreProvider');
  }
  return selector ? selector(store) : store;
}
