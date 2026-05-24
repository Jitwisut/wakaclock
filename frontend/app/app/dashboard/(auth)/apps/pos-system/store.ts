'use client';

import * as React from 'react';

export type Product = {
  category: string;
  id: string;
  image: string;
  name: string;
  price: number;
};

export type ProductCategory = {
  icon: string;
  id: string;
  name: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type TableStatus = 'available' | 'occupied' | 'reserved';

export type Table = {
  category: string;
  id: string;
  name: string;
  status: TableStatus;
};

export type TableCategory = {
  id: string;
  name: string;
};

export type Order = {
  createdAt: Date;
  id: string;
  items: CartItem[];
  status: 'active' | 'cancelled' | 'completed';
  tableId?: string;
  total: number;
};

type Store = {
  addToCart: (product: Product, quantity?: number) => void;
  assignOrderToTable: (tableId: string) => void;

  cart: CartItem[];
  createOrder: () => void;
  orders: Order[];

  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
};

type StoreState = Pick<Store, 'cart' | 'orders'>;

type StoreAction =
  | { product: Product; quantity: number; type: 'addToCart' }
  | { productId: string; quantity: number; type: 'updateQuantity' }
  | { productId: string; type: 'removeFromCart' }
  | { tableId: string; type: 'assignOrderToTable' }
  | { type: 'createOrder' };

const initialState: StoreState = {
  orders: [],
  cart: [],
};

function reducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'addToCart': {
      const existingItem = state.cart.find((item) => item.product.id === action.product.id);

      if (existingItem) {
        return {
          ...state,
          cart: state.cart.map((item) =>
            item.product.id === action.product.id
              ? { ...item, quantity: item.quantity + action.quantity }
              : item
          ),
        };
      }

      return {
        ...state,
        cart: [...state.cart, { product: action.product, quantity: action.quantity }],
      };
    }
    case 'updateQuantity': {
      if (action.quantity <= 0) {
        return {
          ...state,
          cart: state.cart.filter((item) => item.product.id !== action.productId),
        };
      }

      return {
        ...state,
        cart: state.cart.map((item) =>
          item.product.id === action.productId ? { ...item, quantity: action.quantity } : item
        ),
      };
    }
    case 'removeFromCart': {
      return {
        ...state,
        cart: state.cart.filter((item) => item.product.id !== action.productId),
      };
    }
    case 'createOrder': {
      if (state.cart.length === 0) return state;

      const subtotal = state.cart.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const tax = subtotal * 0.05;
      const total = subtotal + tax;

      const newOrder: Order = {
        id: `order-${Date.now()}`,
        items: [...state.cart],
        status: 'active',
        total,
        createdAt: new Date(),
      };

      return {
        ...state,
        orders: [...state.orders, newOrder],
      };
    }
    case 'assignOrderToTable': {
      if (state.cart.length === 0 || state.orders.length === 0) return state;

      const latestOrder = state.orders[state.orders.length - 1];
      const updatedOrder = { ...latestOrder, tableId: action.tableId };

      return {
        ...state,
        orders: [...state.orders.slice(0, -1), updatedOrder],
        cart: [],
      };
    }
    default: {
      return state;
    }
  }
}

const StoreContext = React.createContext<Store | undefined>(undefined);

export function PosSystemStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const addToCart = React.useCallback<Store['addToCart']>((product, quantity = 1) => {
    dispatch({ type: 'addToCart', product, quantity });
  }, []);

  const updateQuantity = React.useCallback<Store['updateQuantity']>((productId, quantity) => {
    dispatch({ type: 'updateQuantity', productId, quantity });
  }, []);

  const removeFromCart = React.useCallback<Store['removeFromCart']>((productId) => {
    dispatch({ type: 'removeFromCart', productId });
  }, []);

  const createOrder = React.useCallback<Store['createOrder']>(() => {
    dispatch({ type: 'createOrder' });
  }, []);

  const assignOrderToTable = React.useCallback<Store['assignOrderToTable']>((tableId) => {
    dispatch({ type: 'assignOrderToTable', tableId });
  }, []);

  const value = React.useMemo<Store>(
    () => ({
      ...state,
      addToCart,
      updateQuantity,
      removeFromCart,
      createOrder,
      assignOrderToTable,
    }),
    [state, addToCart, updateQuantity, removeFromCart, createOrder, assignOrderToTable]
  );

  return React.createElement(StoreContext.Provider, { value }, children);
}

export function useStore(): Store {
  const store = React.useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used within a PosSystemStoreProvider');
  }
  return store;
}
