import type { ForecastResponse } from "@/lib/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline py-2 last:border-b-0">
      <span className="font-mono text-[11px] text-mist">{label}</span>
      <span className="font-mono text-[13px] text-paper tabular">{value}</span>
    </div>
  );
}

export default function ModelReadout({ data }: { data: ForecastResponse }) {
  const m = data.model;
  return (
    <div className="rounded-lg border border-hairline bg-panel p-4 sm:p-5">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber">
        Model readout
      </div>
      <p className="mb-3 font-mono text-[11px] leading-relaxed text-mist">
        {m.architecture}, trained from scratch on this run's fetch — nothing
        pre-baked.
      </p>
      <Row label="Hidden units" value={String(m.hidden_units)} />
      <Row label="Lookback window" value={`${m.lookback_days} days`} />
      <Row label="Training windows" value={String(m.train_windows)} />
      <Row label="Epochs run" value={String(m.epochs_run)} />
      <Row label="Final train MSE" value={m.final_train_mse.toFixed(6)} />
      <Row label="Train time" value={`${m.train_seconds.toFixed(2)}s`} />
      <Row label="Data source" value={data.source} />
      <Row
        label="Generated"
        value={new Date(data.generated_at + "Z").toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      />
    </div>
  );
}
