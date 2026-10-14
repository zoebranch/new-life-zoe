export function isValidOffering(amount: number) {
  const cents = amount * 100;
  return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(Math.round(cents))
    && Math.abs(Math.round(cents) - cents) <= 1e-7;
}
