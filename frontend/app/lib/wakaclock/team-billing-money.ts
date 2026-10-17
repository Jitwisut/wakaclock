// Stripe charge units, not payout units or Intl's ISO currency fraction defaults.
// https://docs.stripe.com/currencies (checked 2026-10-15).
const zeroDecimal = new Set(
  'bif clp djf gnf jpy kmf krw mga pyg rwf vnd vuv xaf xof xpf'.split(' ')
);
export function formatStripePrice(amount: string, currency: string): null | string {
  if (!/^(?:0|[1-9]\d{0,18})$/.test(amount) || !/^[a-z]{3}$/.test(currency)) return null;
  const value = BigInt(amount);
  if ((currency === 'isk' || currency === 'ugx') && value % BigInt(100) !== BigInt(0)) return null;
  const decimals = zeroDecimal.has(currency) ? 0 : 2;
  const divisor = decimals === 0 ? BigInt(1) : BigInt(100);
  const whole = (value / divisor).toLocaleString('en-US');
  const fraction = decimals === 0 ? '' : `.${(value % divisor).toString().padStart(2, '0')}`;
  return `${currency.toUpperCase()} ${whole}${fraction}`;
}
