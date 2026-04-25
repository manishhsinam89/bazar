export type CurrencyCode = "USD" | "INR" | "EUR";
export type Currency = { code: CurrencyCode; name: string; flag: string };

export const CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", flag: "🇺🇸" },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
];

export function useCurrency(): { currency: CurrencyCode; setCurrency: (c: CurrencyCode) => void } {
  return {
    currency: "USD",
    setCurrency: () => {},
  };
}
