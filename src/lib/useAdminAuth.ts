import { useState, useEffect } from "react";

const ADMIN_PASSWORD = "DropBazar2026"; // You can change this password
const AUTH_KEY = "bazar_admin_auth";

export function useAdminAuth() {
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already authenticated
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored === "true") {
      setAuthed(true);
    }
  }, []);

  const login = async (password: string) => {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(AUTH_KEY, "true");
      setAuthed(true);
      setError(null);
    } else {
      setError("Incorrect password");
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuthed(false);
    setError(null);
  };

  return {
    authed,
    login,
    logout,
    error,
  };
}
