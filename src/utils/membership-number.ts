/**
 * Generates a unique membership number.
 * Format: IEB-YYYY-XXXXXX (year + 6 digit sequential-like random)
 */
export function generateMembershipNumber(year?: number): string {
  const y = year || new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `IEB-${y}-${random}`;
}

export function generateApplicationNumber(prefix = 'APP'): string {
  const y = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${y}-${random}`;
}

export function generateRenewalNumber(): string {
  return generateApplicationNumber('REN');
}

export function generateEventCode(prefix = 'EVT'): string {
  const y = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}-${random}`;
}

export function generateRegistrationNumber(prefix = 'PR'): string {
  const y = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${y}-${random}`;
}

export function generateCertificateNumber(): string {
  const y = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `CERT-${y}-${random}`;
}

export function generateQrCode(): string {
  return `QR-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}
