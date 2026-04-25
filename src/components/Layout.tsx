import { Link, useLocation } from "wouter";
import { LANGUAGES, type LangCode } from "../lib/useLanguage";
import { CURRENCIES, type CurrencyCode } from "../lib/useCurrency";
import { useSetting, SETTING_TRYON_ENABLED } from "../lib/useSetting";

interface Props {
  children: React.ReactNode;
  onLogout?: () => void;
  lang?: LangCode;
  onLangChange?: (l: LangCode) => void;
  currency?: CurrencyCode;
  onCurrencyChange?: (c: CurrencyCode) => void;
}

const pickerStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  color: "#e8c080",
  fontSize: "0.7rem",
  fontFamily: "'Noto Sans', sans-serif",
  fontWeight: 600,
  padding: "5px 6px",
  cursor: "pointer",
  outline: "none",
  appearance: "none",
};

export default function Layout({ children, onLogout, lang, onLangChange, currency, onCurrencyChange }: Props) {
  const [location] = useLocation();
  const [tryOnEnabled] = useSetting<boolean>(SETTING_TRYON_ENABLED, false);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <header style={{
        background: "var(--ink)",
        padding: "16px 20px 12px",
        textAlign: "center",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", color: "var(--saffron)" }}>
          बाज़ार AI
        </h1>
        <p style={{ fontSize: "0.65rem", color: "#a07850", letterSpacing: "3px", textTransform: "uppercase", marginTop: "2px" }}>
          Handicraft &amp; General Store
        </p>

        {/* Pickers (top-left) */}
        <div style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          gap: 6,
        }}>
          {lang && onLangChange && (
            <select
              value={lang}
              onChange={e => onLangChange(e.target.value as LangCode)}
              title="AI output language"
              style={pickerStyle}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code} style={{ color: "#1c0f00" }}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          )}
          {currency && onCurrencyChange && (
            <select
              value={currency}
              onChange={e => onCurrencyChange(e.target.value as CurrencyCode)}
              title="Display currency (live rates)"
              style={pickerStyle}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code} style={{ color: "#1c0f00" }}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
          )}
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Lock admin access"
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              color: "#a07850",
              fontSize: "0.68rem",
              fontFamily: "'Noto Sans', sans-serif",
              fontWeight: 600,
              padding: "5px 10px",
              cursor: "pointer",
              letterSpacing: "0.5px",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            🔒 Lock
          </button>
        )}
      </header>

      <nav style={{
        display: "flex",
        borderBottom: "1.5px solid var(--border)",
        background: "var(--card)",
      }}>
        <Link href="/" style={{
          flex: 1,
          textAlign: "center",
          padding: "12px 8px",
          fontSize: "0.78rem",
          fontWeight: 600,
          color: location === "/" ? "var(--saffron)" : "var(--muted)",
          textDecoration: "none",
          letterSpacing: ".5px",
          borderBottom: location === "/" ? "2.5px solid var(--saffron)" : "2.5px solid transparent",
          transition: "color .2s",
        }}>
          📷 Add Product
        </Link>
        <Link href="/shop" style={{
          flex: 1,
          textAlign: "center",
          padding: "12px 8px",
          fontSize: "0.78rem",
          fontWeight: 600,
          color: location === "/shop" ? "var(--saffron)" : "var(--muted)",
          textDecoration: "none",
          letterSpacing: ".5px",
          borderBottom: location === "/shop" ? "2.5px solid var(--saffron)" : "2.5px solid transparent",
          transition: "color .2s",
        }}>
          🛍️ Customer Shop
        </Link>
        {tryOnEnabled && (
          <Link href="/tryon" style={{
            flex: 1,
            textAlign: "center",
            padding: "12px 8px",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: location === "/tryon" ? "var(--saffron)" : "var(--muted)",
            textDecoration: "none",
            letterSpacing: ".5px",
            borderBottom: location === "/tryon" ? "2.5px solid var(--saffron)" : "2.5px solid transparent",
            transition: "color .2s",
          }}>
            ✨ Try-On AR
          </Link>
        )}
        <Link href="/settings" style={{
          flex: "0 0 auto",
          textAlign: "center",
          padding: "12px 14px",
          fontSize: "0.9rem",
          color: location === "/settings" ? "var(--saffron)" : "var(--muted)",
          textDecoration: "none",
          borderBottom: location === "/settings" ? "2.5px solid var(--saffron)" : "2.5px solid transparent",
          transition: "color .2s",
        }} title="Settings">
          ⚙️
        </Link>
      </nav>

      {children}
    </div>
  );
}
