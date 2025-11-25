import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TradeQuote } from '../core/trade/dataService';

interface TradeState {
  sidebarOpen: boolean;
  activeSymbol: string;
  watchlist: string[];
  quotes: Record<string, TradeQuote | undefined>;
  setSidebarOpen: (open: boolean) => void;
  setActiveSymbol: (symbol: string) => void;
  addToWatchlist: (symbol: string) => void;
  updateQuote: (symbol: string, quote: TradeQuote) => void;
}

const DEFAULT_SYMBOL = 'AAPL';
const DEFAULT_WATCHLIST = ['AAPL', 'TSLA', 'NVDA'];

export const useTradeStore = create<TradeState>()(
  persist(
    set => ({
      sidebarOpen: false,
      activeSymbol: DEFAULT_SYMBOL,
      watchlist: DEFAULT_WATCHLIST,
      quotes: {},
      setSidebarOpen: open => set({ sidebarOpen: open }),
      setActiveSymbol: symbol => set({ activeSymbol: symbol }),
      addToWatchlist: symbol =>
        set(state => ({
          watchlist: state.watchlist.includes(symbol)
            ? state.watchlist
            : [...state.watchlist, symbol],
        })),
      updateQuote: (symbol, quote) =>
        set(state => ({
          quotes: {
            ...state.quotes,
            [symbol]: quote,
          },
        })),
    }),
    {
      name: 'omnibrowser:trade-state',
      version: 1,
      partialize: state => ({
        activeSymbol: state.activeSymbol,
        watchlist: state.watchlist,
      }),
    }
  )
);
