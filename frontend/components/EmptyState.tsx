import { ArrowUpRight } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="animate-rise rounded-lg border border-dashed border-hairline bg-panel/40 px-6 py-16 text-center sm:py-24">
      <div className="mx-auto max-w-md">
        <h2 className="font-display text-2xl italic text-paper sm:text-3xl">
          Type a ticker. Watch it train.
        </h2>
        <p className="mt-3 font-mono text-[13px] leading-relaxed text-mist">
          Every run fetches live daily closes for the symbol you enter, trains
          a fresh LSTM network on that series from scratch, and forecasts
          forward — nothing here is precomputed.
        </p>
        <div className="mt-6 flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
          Enter a symbol above to begin
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
