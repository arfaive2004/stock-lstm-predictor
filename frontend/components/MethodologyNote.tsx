export default function MethodologyNote() {
  return (
    <div className="border-t border-hairline px-6 py-10 sm:px-10">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
            How this works
          </h3>
          <p className="mt-2 font-mono text-[12px] leading-relaxed text-mist">
            Daily closes are fetched live for whatever symbol you enter. A
            single-layer LSTM — implemented from scratch in NumPy, not a
            pre-trained model — is trained on that series in-request, then
            walk-forward validated on the most recent held-out days to get an
            honest error estimate. The uncertainty band widens with the
            square root of the step count, a standard random-walk heuristic
            anchored to that validation error — a transparent approximation,
            not a calibrated statistical interval.
          </p>
        </div>
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
            Not financial advice
          </h3>
          <p className="mt-2 font-mono text-[12px] leading-relaxed text-mist">
            This is an educational demonstration of sequence modeling, not
            investment guidance. Short-horizon price forecasts from a small
            model trained on price history alone carry wide, genuine
            uncertainty. Treat every number here as a technical output to
            inspect, not a signal to trade on.
          </p>
        </div>
      </div>
    </div>
  );
}
