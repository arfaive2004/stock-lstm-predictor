"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Fetching live daily closes…",
  "Normalizing the price series…",
  "Training LSTM gates (forget / input / output)…",
  "Walk-forward validating on held-out days…",
  "Forecasting forward…",
];

export default function LoadingState() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 750);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="animate-rise rounded-lg border border-hairline bg-panel px-6 py-16 text-center sm:py-24">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-8 w-1.5 rounded-full bg-amber"
              style={{
                animation: `pulse-soft 1.1s ease-in-out ${i * 0.12}s infinite`,
              }}
            />
          ))}
        </div>
        <p className="font-mono text-[13px] text-mist">{STAGES[stage]}</p>
      </div>
    </div>
  );
}
