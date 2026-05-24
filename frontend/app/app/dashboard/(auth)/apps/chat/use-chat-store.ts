'use client';

import * as React from 'react';

import type { ChatItemProps } from '@/app/dashboard/(auth)/apps/chat/types';

interface ChatStore {
  selectedChat: ChatItemProps | null;
  setSelectedChat: (chat: ChatItemProps | null) => void;
  showProfileSheet: boolean;
  toggleProfileSheet: (value: boolean) => void;
}

type ChatState = Pick<ChatStore, 'selectedChat' | 'showProfileSheet'>;

type ChatAction =
  | { chat: ChatItemProps | null; type: 'setSelectedChat' }
  | { type: 'toggleProfileSheet'; value: boolean };

const initialState: ChatState = {
  selectedChat: null,
  showProfileSheet: false,
};

function reducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'setSelectedChat': {
      return {
        ...state,
        selectedChat: action.chat,
      };
    }
    case 'toggleProfileSheet': {
      return {
        ...state,
        showProfileSheet: action.value,
      };
    }
    default: {
      return state;
    }
  }
}

const ChatStoreContext = React.createContext<ChatStore | undefined>(undefined);

export function ChatStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const setSelectedChat = React.useCallback<ChatStore['setSelectedChat']>((chat) => {
    dispatch({ type: 'setSelectedChat', chat });
  }, []);

  const toggleProfileSheet = React.useCallback<ChatStore['toggleProfileSheet']>((value) => {
    dispatch({ type: 'toggleProfileSheet', value });
  }, []);

  const value = React.useMemo<ChatStore>(
    () => ({
      ...state,
      setSelectedChat,
      toggleProfileSheet,
    }),
    [state, setSelectedChat, toggleProfileSheet]
  );

  return React.createElement(ChatStoreContext.Provider, { value }, children);
}

export default function useChatStore(): ChatStore {
  const store = React.useContext(ChatStoreContext);
  if (!store) {
    throw new Error('useChatStore must be used within a ChatStoreProvider');
  }
  return store;
}
