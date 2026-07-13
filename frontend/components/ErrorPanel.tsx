import { TriangleAlert } from "lucide-react";

export default function ErrorPanel({ message, status }: { message: string; status?: number }) {
  const hint =
    status === 404
      ? "Check the symbol's spelling — try the exchange ticker exactly as quoted (e.g. BRK.B, not BRK)."
      : status === 422
      ? "This symbol doesn't have enough trading history yet for the model to learn from. Try a longer history window or a more established ticker."
      : status === 502
      ? "The live data source didn't return anything usable. Wait a moment and run the forecast again."
      : "Check your connection to the backend and try again.";

  return (
    <div className="animate-rise flex items-start gap-3 rounded-lg border border-drop/30 bg-drop/[0.06] p-4 sm:p-5">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-drop" strokeWidth={2} />
      <div>
        <div className="font-mono text-sm text-paper">{message}</div>
        <div className="mt-1 font-mono text-[12px] text-mist">{hint}</div>
      </div>
    </div>
  );
}
