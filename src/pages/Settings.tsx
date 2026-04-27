import { useState } from "react";
import Layout from "../components/Layout";
import { useLanguage } from "../lib/useLanguage";
import { useCurrency } from "../lib/useCurrency";
import { useSetting, SETTING_TRYON_ENABLED, SETTING_AUTO_CLEAN } from "../lib/useSetting";

export default function Settings() {
  const { lang, setLang } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const [tryon, setTryon] = useSetting<boolean>(SETTING_TRYON_ENABLED, false);
  const [autoClean, setAutoClean] = useSetting<boolean>(SETTING_AUTO_CLEAN, true);
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem("ollama_url") || "");
  const [ollamaStatus, setOllamaStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  const saveOllamaUrl = (url: string) => {
    const trimmed = url.trim().replace(/\/+$/, "");
    setOllamaUrl(trimmed);
    if (trimmed) {
      localStorage.setItem("ollama_url", trimmed);
    } else {
      localStorage.removeItem("ollama_url");
    }
  };

  const testOllama = async () => {
    const url = ollamaUrl.trim() || "http://localhost:11434";
    setOllamaStatus("testing");
    try {
      const res = await fetch(`${url}/api/tags`, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        const hasLlava = data.models?.some((m: any) => m.name?.includes("llava"));
        setOllamaStatus("ok");
        alert(hasLlava
          ? `✅ Connected! LLaVA model found. ${data.models.length} model(s) available.`
          : `⚠️ Connected but no LLaVA model found. Run: ollama pull llava`);
      } else {
        setOllamaStatus("fail");
      }
    } catch {
      setOllamaStatus("fail");
      alert("❌ Cannot reach Ollama. Check the URL and make sure Ollama is running.");
    }
  };

  return (
    <Layout lang={lang} onLangChange={setLang} currency={currency} onCurrencyChange={setCurrency}>
      <main style={{ flex: 1, maxWidth: 520, margin: "0 auto", width: "100%", padding: "20px 16px 40px" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", color: "var(--ink)", marginBottom: 4 }}>
          ⚙️ Demo Settings
        </h2>
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 20 }}>
          Toggle features for the live demo.
        </p>

        <SettingRow
          title="Auto-clean product photos"
          desc="Auto-rotate, trim plain backgrounds, and shrink images on upload. Recommended."
          checked={autoClean}
          onChange={setAutoClean}
        />

        <SettingRow
          title="Virtual Try-On (AR)"
          desc="Experimental: lets customers see clothing items on their body using the camera. Best for stitched garments."
          checked={tryon}
          onChange={setTryon}
          experimental
        />

        {/* Ollama URL config */}
        <div style={{
          background: "var(--card)", border: "1.5px solid var(--border)",
          borderRadius: 12, padding: "14px 16px", marginTop: 12, marginBottom: 12,
        }}>
          <strong style={{ fontSize: "0.92rem", color: "var(--ink)" }}>🏠 Ollama Server URL</strong>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
            To use local AI from any device, run <code>ngrok http 11434</code> on your PC and paste the ngrok URL here.
            Leave blank for <code>http://localhost:11434</code>.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              type="url"
              value={ollamaUrl}
              onChange={e => saveOllamaUrl(e.target.value)}
              placeholder="https://abc123.ngrok-free.app"
              style={{
                flex: 1, padding: "8px 10px", borderRadius: 8,
                border: "1.5px solid var(--border)", fontSize: "0.82rem",
                fontFamily: "monospace", background: "#faf6ef",
              }}
            />
            <button
              onClick={testOllama}
              disabled={ollamaStatus === "testing"}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: ollamaStatus === "ok" ? "#2e7d32" : ollamaStatus === "fail" ? "#c62828" : "var(--saffron)",
                color: "#fff", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
              }}
            >
              {ollamaStatus === "testing" ? "..." : ollamaStatus === "ok" ? "✓ OK" : "Test"}
            </button>
          </div>
        </div>

        <div style={{
          marginTop: 24, padding: "12px 14px",
          background: "#f8efde", border: "1.5px solid var(--border)",
          borderRadius: 12, fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.6,
        }}>
          💡 Tip: settings are saved on this device only. Each demo phone or tablet
          can have its own configuration.
        </div>
      </main>
    </Layout>
  );
}

function SettingRow({
  title, desc, checked, onChange, experimental,
}: {
  title: string; desc: string; checked: boolean; onChange: (v: boolean) => void; experimental?: boolean;
}) {
  return (
    <div style={{
      background: "var(--card)", border: "1.5px solid var(--border)",
      borderRadius: 12, padding: "14px 16px", marginBottom: 12,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: "0.92rem", color: "var(--ink)" }}>{title}</strong>
          {experimental && (
            <span style={{
              fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: 1.2,
              background: "var(--terracotta)", color: "#fff",
              padding: "2px 6px", borderRadius: 6, fontWeight: 700,
            }}>Beta</span>
          )}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 26, borderRadius: 13,
          background: checked ? "var(--saffron)" : "#d6c4a4",
          border: "none", position: "relative", cursor: "pointer",
          transition: "background .2s", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute",
          top: 3, left: checked ? 21 : 3,
          width: 20, height: 20, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left .18s",
        }} />
      </button>
    </div>
  );
}
