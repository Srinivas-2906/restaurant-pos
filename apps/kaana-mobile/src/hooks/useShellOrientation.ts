import { useEffect } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import type { TerminalDeviceType } from "../session/types";

export function useShellOrientation(deviceType?: TerminalDeviceType | "management") {
  useEffect(() => {
    let cancelled = false;

    async function apply() {
      if (cancelled) return;
      switch (deviceType) {
        case "kds":
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          break;
        case "captain":
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          break;
        case "management":
        case "pos":
        default:
          await ScreenOrientation.unlockAsync();
          break;
      }
    }

    void apply();

    return () => {
      cancelled = true;
      void ScreenOrientation.unlockAsync();
    };
  }, [deviceType]);
}
