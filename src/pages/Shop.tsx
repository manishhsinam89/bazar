import Layout from "../components/Layout";
import { useLanguage } from "../lib/useLanguage";
import { useCurrency } from "../lib/useCurrency";

export default function Shop() {
  const { lang, setLang } = useLanguage();
  const { currency, setCurrency } = useCurrency();

  return (
    <Layout lang={lang} onLangChange={setLang} currency={currency} onCurrencyChange={setCurrency}>
      <main style={{
        flex: 1,
        padding: "20px 16px 40px",
        maxWidth: 800,
        margin: "0 auto",
        width: "100%",
        textAlign: "center",
      }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", color: "var(--ink)" }}>
          🛍️ Customer Shop
        </h2>
        <p style={{ color: "var(--muted)", marginTop: 12 }}>
          Browse our handcrafted products
        </p>
      </main>
    </Layout>
  );
}
