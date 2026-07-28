type DiagnosticValue = boolean | number | string | null | undefined;

export function logPasswordVaultDiagnostic(event: string, details: Record<string, DiagnosticValue> = {}): void {
  const safeDetails = Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
  console.warn(`[PasswordVault] ${event}`, safeDetails);
}

export function passwordVaultErrorKind(cause: unknown): string {
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: unknown }).code;
    const safeCode = typeof code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(code) ? code : null;
    return [cause.name || 'Error', safeCode].filter(Boolean).join(':');
  }
  return typeof cause;
}
