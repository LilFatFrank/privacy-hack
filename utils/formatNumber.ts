/**
 * Formats a number with K, M, B suffix and up to 2 decimal places.
 * - Rounds up decimals
 * - Removes trailing zero in decimal (e.g., 1.50 -> 1.5)
 * - Removes decimal entirely if .0 (e.g., 1.0 -> 1)
 *
 * Examples:
 * - 999 -> "999"
 * - 1000 -> "1K"
 * - 1234 -> "1.24K"
 * - 1500 -> "1.5K"
 * - 10000 -> "10K"
 * - 101780 -> "101.78K"
 * - 1000000 -> "1M"
 * - 1500000000 -> "1.5B"
 */
export function formatNumber(num: number): string {
  if (num < 0) {
    return `-${formatNumber(Math.abs(num))}`;
  }

  const suffixes = [
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" },
  ];

  for (const { value, suffix } of suffixes) {
    if (num >= value) {
      const scaled = num / value;
      // Round up to 2 decimal places
      const rounded = Math.ceil(scaled * 100) / 100;
      // Format with up to 2 decimals, remove trailing zeros
      const formatted = rounded.toFixed(2).replace(/\.?0+$/, "");
      return `${formatted}${suffix}`;
    }
  }

  // For numbers less than 1000
  if (Number.isInteger(num)) {
    return num.toString();
  }

  // Round up to 2 decimal places
  const rounded = Math.ceil(num * 100) / 100;
  // Remove trailing zeros
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Formats a currency amount (USDC) with proper formatting
 */
export function formatUSDC(amount: number): string {
  return `${formatNumber(amount)} USDC`;
}
