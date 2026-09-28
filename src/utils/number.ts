export function round2(value: number | string): number {
  return Math.round(Number(value) * 100) / 100;
}

export function calculateVat(amount: number, vatRate: number): number {
  return round2((amount * vatRate) / 100);
}

export function calculateSubtotal(quantity: number, unitPrice: number, discount = 0): number {
  return round2(quantity * unitPrice - discount);
}

export function generateNumber(prefix: string, count: number): string {
  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
}
