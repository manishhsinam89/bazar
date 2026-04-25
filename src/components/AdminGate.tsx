import { useState } from "react";

interface AdminGateProps {
  error?: string | null;
  onLogin: (password: string) => Promise<void>;
}

export default function AdminGate({ error, onLogin }: AdminGateProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (password: string) => {
    setLoading(true);
    try {
      await onLogin(password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: "40px 20px",
      textAlign: "center",
      fontFamily: "'Noto Sans', sans-serif",
    }}>
      <h2>🔐 Admin Access</h2>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>Please log in to continue</p>
      {error && <p style={{ color: "var(--terracotta)", marginTop: 12 }}>{error}</p>}
      <input
        type="password"
        placeholder="Enter password"
        disabled={loading}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading) {
            handleLogin((e.target as HTMLInputElement).value);
          }
        }}
        style={{
          marginTop: 16,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          width: "100%",
          maxWidth: 240,
          opacity: loading ? 0.6 : 1,
        }}
      />
      {loading && <p style={{ color: "var(--muted)", marginTop: 12 }}>Authenticating...</p>}
    </div>
  );
}
