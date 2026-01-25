// Simulation: Your 0.5% fee vs costs you cover

const SOL_PRICE = 127.06; // from config
const USDC_RENT_FEE = 0.76; // ~$0.76 USDC
const PROTOCOL_FEE_RATE = 0.0035; // 0.35%
const YOUR_FEE_RATE = 0.005; // 0.5%
const GAS_FOR_DEPOSIT_SOL = 0.003; // ~0.003 SOL for deposit tx

const GAS_FOR_DEPOSIT_USD = GAS_FOR_DEPOSIT_SOL * SOL_PRICE;

console.log("=== Fee Simulation ===\n");
console.log("Your fee: 0.5%");
console.log("You cover:");
console.log(`  - Protocol fee: 0.35%`);
console.log(`  - Rent fee: $${USDC_RENT_FEE.toFixed(2)} USDC`);
console.log(`  - Gas (deposit): ~${GAS_FOR_DEPOSIT_SOL} SOL ($${GAS_FOR_DEPOSIT_USD.toFixed(2)})`);
console.log("\n");

console.log("┌────────────┬────────────┬────────────┬────────────┬────────────┐");
console.log("│ Amount ($) │ Your Fee   │ Your Costs │ Profit     │ Margin     │");
console.log("├────────────┼────────────┼────────────┼────────────┼────────────┤");

const amounts = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000];

for (const amount of amounts) {
  const yourFee = amount * YOUR_FEE_RATE;

  // Costs you cover
  const protocolFee = amount * PROTOCOL_FEE_RATE;
  const rentFee = USDC_RENT_FEE;
  const gasCost = GAS_FOR_DEPOSIT_USD;

  const totalCost = protocolFee + rentFee + gasCost;
  const profit = yourFee - totalCost;
  const margin = (profit / yourFee) * 100;

  const profitStr = profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`;
  const marginStr = `${margin.toFixed(1)}%`;

  console.log(`│ $${amount.toString().padEnd(9)} │ $${yourFee.toFixed(2).padEnd(9)} │ $${totalCost.toFixed(2).padEnd(9)} │ ${profitStr.padEnd(10)} │ ${marginStr.padEnd(10)} │`);
}

console.log("└────────────┴────────────┴────────────┴────────────┴────────────┘");

// Find break-even point
const breakEven = (USDC_RENT_FEE + GAS_FOR_DEPOSIT_USD) / (YOUR_FEE_RATE - PROTOCOL_FEE_RATE);
console.log(`\n💡 Break-even point: $${breakEven.toFixed(2)} USDC`);
console.log(`   Below this amount, you LOSE money`);
console.log(`   Above this amount, you PROFIT`);

// Summary
console.log("\n=== Summary ===");
console.log(`Per-transaction fixed costs: $${(USDC_RENT_FEE + GAS_FOR_DEPOSIT_USD).toFixed(2)}`);
console.log(`Variable margin (0.5% - 0.35%): 0.15% per dollar`);
console.log(`\nFor $100 transaction: Profit = $${(100 * 0.0015 - USDC_RENT_FEE - GAS_FOR_DEPOSIT_USD).toFixed(2)}`);
console.log(`For $1000 transaction: Profit = $${(1000 * 0.0015 - USDC_RENT_FEE - GAS_FOR_DEPOSIT_USD).toFixed(2)}`);
