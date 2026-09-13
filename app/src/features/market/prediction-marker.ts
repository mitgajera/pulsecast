export const PREDICTION_MARKER_EVENT = "pulsecast:prediction-marker";

export type PredictionMarker = {
  price: number;
  roundId: string;
  wallet: string;
};

export function savePredictionMarker(marker: PredictionMarker) {
  window.localStorage.setItem(markerKey(marker.wallet, marker.roundId), String(marker.price));
  window.dispatchEvent(new CustomEvent<PredictionMarker>(PREDICTION_MARKER_EVENT, { detail: marker }));
}

export function loadPredictionMarker(wallet: string, roundId: string) {
  const value = Number(window.localStorage.getItem(markerKey(wallet, roundId)));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function markerKey(wallet: string, roundId: string) {
  return `pulsecast:prediction:${wallet}:${roundId}`;
}
