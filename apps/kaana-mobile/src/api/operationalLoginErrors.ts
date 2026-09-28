/** Online operational login could not reach the API (network / server down). */
export class OperationalNetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message);
    this.name = "OperationalNetworkError";
  }
}

/** Employee is not eligible for this device type (server responded successfully). */
export class OperationalAccessDeniedError extends Error {
  constructor(message = "Application access not granted for this device") {
    super(message);
    this.name = "OperationalAccessDeniedError";
  }
}

export function isOperationalNetworkError(error: unknown): boolean {
  if (error instanceof OperationalNetworkError) return true;
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("unable to connect") ||
    msg.includes("timeout")
  );
}

export function isOperationalAccessDeniedError(error: unknown): boolean {
  return error instanceof OperationalAccessDeniedError;
}

export const INTERNET_REQUIRED_FIRST_MESSAGE =
  "Connect to the internet to sign in on this device first.";

export function accessDeniedMessage(deviceLabel: string): string {
  return `You don't have access to ${deviceLabel} on this device.`;
}

export type ResolveLoginErrorInput = {
  error: unknown;
  deviceLabel: string;
  hasOfflineCredential: boolean;
};

export type ResolveLoginErrorResult =
  | { action: "access_denied"; message: string }
  | { action: "internet_required"; message: string }
  | { action: "try_offline" }
  | { action: "show_message"; message: string };

export function resolveOperationalLoginFailure(
  input: ResolveLoginErrorInput,
): ResolveLoginErrorResult {
  const { error, deviceLabel, hasOfflineCredential } = input;

  if (isOperationalAccessDeniedError(error)) {
    return { action: "access_denied", message: accessDeniedMessage(deviceLabel) };
  }

  if (isOperationalNetworkError(error)) {
    if (hasOfflineCredential) {
      return { action: "try_offline" };
    }
    return { action: "internet_required", message: INTERNET_REQUIRED_FIRST_MESSAGE };
  }

  const message =
    error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("failed to fetch")
  ) {
    if (hasOfflineCredential) {
      return { action: "try_offline" };
    }
    return { action: "internet_required", message: INTERNET_REQUIRED_FIRST_MESSAGE };
  }

  if (
    lower.includes("access not granted") ||
    lower.includes("forbidden") ||
    lower.includes("403")
  ) {
    return { action: "access_denied", message: accessDeniedMessage(deviceLabel) };
  }

  return { action: "show_message", message: mapPinLoginErrorFallback(error, deviceLabel) };
}

function mapPinLoginErrorFallback(error: unknown, deviceLabel: string): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("invalid employee") || message.includes("invalid") || message.includes("401")) {
    return "Invalid employee ID or PIN.";
  }
  if (message.includes("locked")) {
    return "This PIN is temporarily locked. Try again later or contact your manager.";
  }
  return "Sign-in failed. Check your employee ID and PIN.";
}
