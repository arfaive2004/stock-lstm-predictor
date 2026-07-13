import { Radio } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-hairline px-6 py-5 sm:px-10">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-xl italic tracking-tight text-paper sm:text-2xl">
          Signal Room
        </span>
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-mist sm:inline">
          / LSTM Forecasting Terminal
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-hairline bg-panel px-3 py-1.5">
        <Radio className="h-3 w-3 text-rally animate-pulse-soft" strokeWidth={2.5} />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
          Live market data
        </span>
      </div>
    </header>
  );
}
