export const NumberUtil = {
  round(value: number, fractionDigits = 2): number {
    const safeDigits = Number.isInteger(fractionDigits) && fractionDigits >= 0
      ? fractionDigits
      : 2;
    const factor = 10 ** safeDigits;
    return Math.round(value * factor) / factor;
  },

  round2(value: number): number {
    return this.round(value, 2);
  },
} as const;
