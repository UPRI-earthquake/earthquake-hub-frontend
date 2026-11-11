import { useContext } from "react";
import { OverlayStateContext } from "../contexts/OverlayStateContext";

export function useOverlayState() {
  const ctx = useContext(OverlayStateContext);
  if (!ctx) throw new Error('useOverlayState must be used within OverlayStateProvider');
  return ctx;
}