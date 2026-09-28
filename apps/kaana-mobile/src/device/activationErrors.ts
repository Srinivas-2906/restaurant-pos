export function mapActivationError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("network") || message.includes("fetch")) {
    return "Unable to reach Kaana. Check your network connection and try again.";
  }
  if (message.includes("expired")) {
    return "This activation code has expired. Ask your administrator for a new code.";
  }
  if (message.includes("invalid") || message.includes("unauthorized")) {
    return "That activation code is not valid. Check the code and try again.";
  }
  if (message.includes("revoked") || message.includes("inactive")) {
    return "This device has been deactivated. Contact your restaurant administrator.";
  }
  if (message.includes("not enabled") || message.includes("module")) {
    return "This device type is not enabled for your restaurant. Contact your administrator.";
  }
  if (message.includes("403") || message.includes("forbidden")) {
    return "This device type is not available for your restaurant right now.";
  }
  return "Activation failed. Please try again or contact your administrator.";
}

export function mapPinLoginError(error: unknown, deviceLabel: string): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("network") || message.includes("fetch")) {
    return "Unable to reach Kaana. Check your network connection.";
  }
  if (
    error instanceof Error &&
    error.name === "OperationalAccessDeniedError"
  ) {
    return `You don't have access to ${deviceLabel} on this device.`;
  }
  if (
    message.includes("access not granted") ||
    message.includes("forbidden") ||
    message.includes("403")
  ) {
    return `You don't have access to ${deviceLabel} on this device.`;
  }
  if (message.includes("invalid employee") || message.includes("invalid") || message.includes("401")) {
    return "Invalid employee ID or PIN.";
  }
  if (message.includes("locked")) {
    return "This PIN is temporarily locked. Try again later or contact your manager.";
  }
  return "Sign-in failed. Check your employee ID and PIN.";
}

export function mapManagementLoginError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("network") || message.includes("fetch")) {
    return "Unable to reach Kaana. Check your network connection.";
  }
  return "Invalid email or password.";
}
