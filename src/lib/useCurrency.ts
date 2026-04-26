export type CurrencyCode = "USD" | "INR" | "EUR" | "MAD";
export type Currency = { code: CurrencyCode; name: string; flag: string };

export const CURRENCIES: Currency[] = [
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
  { code: "USD", name: "US Dollar", flag: "🇺🇸" },
  { code: "MAD", name: "Moroccan Dirham", flag: "🇲🇦" },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳" },
];

export function useCurrency(): { currency: CurrencyCode; setCurrency: (c: CurrencyCode) => void } {
  return {
    currency: "EUR", // Default to EUR as requested
    setCurrency: () => {},
  };
}
