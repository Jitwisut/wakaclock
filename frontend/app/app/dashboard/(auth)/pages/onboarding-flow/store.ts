'use client';

import * as React from 'react';

export interface OnboardingData {
  accountType: string;
  interests: string[];
  workPreferences: {
    availability: string;
    experience: string;
    workStyle: string;
  };
}

interface OnboardingStore {
  currentStep: number;
  data: OnboardingData;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
  setCurrentStep: (step: number) => void;
  updateAccountType: (accountType: string) => void;
  updateInterests: (interests: string[]) => void;
  updateWorkPreferences: (preferences: Partial<OnboardingData['workPreferences']>) => void;
}

const initialData: OnboardingData = {
  interests: [],
  workPreferences: {
    workStyle: '',
    experience: '',
    availability: '',
  },
  accountType: '',
};

type OnboardingState = Pick<OnboardingStore, 'currentStep' | 'data'>;

type OnboardingAction =
  | { accountType: string; type: 'updateAccountType' }
  | { interests: string[]; type: 'updateInterests' }
  | { preferences: Partial<OnboardingData['workPreferences']>; type: 'updateWorkPreferences' }
  | { step: number; type: 'setCurrentStep' }
  | { type: 'nextStep' }
  | { type: 'prevStep' }
  | { type: 'reset' };

const initialState: OnboardingState = {
  currentStep: 0,
  data: initialData,
};

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'setCurrentStep': {
      return {
        ...state,
        currentStep: action.step,
      };
    }
    case 'updateInterests': {
      return {
        ...state,
        data: { ...state.data, interests: action.interests },
      };
    }
    case 'updateWorkPreferences': {
      return {
        ...state,
        data: {
          ...state.data,
          workPreferences: { ...state.data.workPreferences, ...action.preferences },
        },
      };
    }
    case 'updateAccountType': {
      return {
        ...state,
        data: { ...state.data, accountType: action.accountType },
      };
    }
    case 'nextStep': {
      return {
        ...state,
        currentStep: state.currentStep + 1,
      };
    }
    case 'prevStep': {
      return {
        ...state,
        currentStep: Math.max(0, state.currentStep - 1),
      };
    }
    case 'reset': {
      return initialState;
    }
    default: {
      return state;
    }
  }
}

const OnboardingStoreContext = React.createContext<OnboardingStore | undefined>(undefined);

export function OnboardingStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const setCurrentStep = React.useCallback<OnboardingStore['setCurrentStep']>((step) => {
    dispatch({ type: 'setCurrentStep', step });
  }, []);

  const updateInterests = React.useCallback<OnboardingStore['updateInterests']>((interests) => {
    dispatch({ type: 'updateInterests', interests });
  }, []);

  const updateWorkPreferences = React.useCallback<OnboardingStore['updateWorkPreferences']>(
    (preferences) => {
      dispatch({ type: 'updateWorkPreferences', preferences });
    },
    []
  );

  const updateAccountType = React.useCallback<OnboardingStore['updateAccountType']>(
    (accountType) => {
      dispatch({ type: 'updateAccountType', accountType });
    },
    []
  );

  const nextStep = React.useCallback<OnboardingStore['nextStep']>(() => {
    dispatch({ type: 'nextStep' });
  }, []);

  const prevStep = React.useCallback<OnboardingStore['prevStep']>(() => {
    dispatch({ type: 'prevStep' });
  }, []);

  const reset = React.useCallback<OnboardingStore['reset']>(() => {
    dispatch({ type: 'reset' });
  }, []);

  const value = React.useMemo<OnboardingStore>(
    () => ({
      ...state,
      setCurrentStep,
      updateInterests,
      updateWorkPreferences,
      updateAccountType,
      nextStep,
      prevStep,
      reset,
    }),
    [
      state,
      setCurrentStep,
      updateInterests,
      updateWorkPreferences,
      updateAccountType,
      nextStep,
      prevStep,
      reset,
    ]
  );

  return React.createElement(OnboardingStoreContext.Provider, { value }, children);
}

export function useOnboardingStore(): OnboardingStore {
  const store = React.useContext(OnboardingStoreContext);
  if (!store) {
    throw new Error('useOnboardingStore must be used within an OnboardingStoreProvider');
  }
  return store;
}
