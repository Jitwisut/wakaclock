'use client';

import * as React from 'react';

import type { Mail } from './data';

type MailStore = {
  selectedMail: Mail | null;
  setSelectedMail: (mail: Mail | null) => void;
};

const MailStoreContext = React.createContext<MailStore | undefined>(undefined);

export function MailStoreProvider({ children }: { children: React.ReactNode }) {
  const [selectedMail, setSelectedMailState] = React.useState<Mail | null>(null);

  const setSelectedMail = React.useCallback<MailStore['setSelectedMail']>((mail) => {
    setSelectedMailState(mail);
  }, []);

  const value = React.useMemo<MailStore>(
    () => ({
      selectedMail,
      setSelectedMail,
    }),
    [selectedMail, setSelectedMail]
  );

  return React.createElement(MailStoreContext.Provider, { value }, children);
}

export function useMailStore(): MailStore {
  const store = React.useContext(MailStoreContext);
  if (!store) {
    throw new Error('useMailStore must be used within a MailStoreProvider');
  }
  return store;
}
