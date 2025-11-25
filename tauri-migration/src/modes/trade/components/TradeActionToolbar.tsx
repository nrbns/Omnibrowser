import type { ReactNode } from 'react';
import { Activity, BellDot, Bot, PenTool, Sparkles, TrendingUp } from 'lucide-react';

type TradeActionToolbarProps = {
  onIndicatorAdd: (type: string) => void;
  onDrawingTool: (tool: string) => void;
  onCreateAlert: () => void;
  onAutomation: (preset: string) => void;
};

const toolbarButtons: Array<{
  id: string;
  label: string;
  icon: ReactNode;
  handler: keyof TradeActionToolbarProps;
  payload?: string;
}> = [
  { id: 'indicator', label: 'Indicators', icon: <Activity size={16} />, handler: 'onIndicatorAdd', payload: 'rsi14' },
  { id: 'drawing', label: 'Draw Fib', icon: <PenTool size={16} />, handler: 'onDrawingTool', payload: 'fibonacci' },
  { id: 'trend', label: 'Auto Trend', icon: <TrendingUp size={16} />, handler: 'onDrawingTool', payload: 'trendline' },
  { id: 'alert', label: 'Price Alert', icon: <BellDot size={16} />, handler: 'onCreateAlert' },
  { id: 'ai', label: 'AI Predict', icon: <Sparkles size={16} />, handler: 'onAutomation', payload: 'ai_predict' },
  { id: 'auto', label: 'Auto Trade', icon: <Bot size={16} />, handler: 'onAutomation', payload: 'auto_trade' },
];

export function TradeActionToolbar({
  onIndicatorAdd,
  onDrawingTool,
  onCreateAlert,
  onAutomation,
}: TradeActionToolbarProps) {
  return (
    <div className="hidden md:flex md:flex-col w-16 bg-neutral-900/90 border border-neutral-800 rounded-2xl p-2 gap-2">
      {toolbarButtons.map(button => {
        const isAlert = button.handler === 'onCreateAlert';
        const handler =
          button.handler === 'onIndicatorAdd'
            ? () => onIndicatorAdd(button.payload ?? '')
            : button.handler === 'onDrawingTool'
              ? () => onDrawingTool(button.payload ?? '')
              : button.handler === 'onAutomation'
                ? () => onAutomation(button.payload ?? '')
                : onCreateAlert;

        return (
          <button
            key={button.id}
            onClick={handler}
            className="flex flex-col items-center justify-center rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs text-gray-300 px-2 py-3 transition"
            aria-label={button.label}
            type="button"
          >
            <span className={isAlert ? 'text-amber-400' : 'text-emerald-300'}>{button.icon}</span>
            <span className="mt-1 text-[10px] uppercase tracking-wider">{button.label}</span>
          </button>
        );
      })}
    </div>
  );
}
