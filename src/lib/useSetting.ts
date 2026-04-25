import { useCallback, useEffect, useState } from "react";

const PREFIX = "bazaar.setting.";
const listeners = new Map<string, Set<(v: any) => void>>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useSetting<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    const set = listeners.get(key) ?? new Set();
    set.add(setVal as any);
    listeners.set(key, set);
    return () => { set.delete(setVal as any); };
  }, [key]);

  const update = useCallback((v: T) => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(v));
    } catch { /* ignore */ }
    listeners.get(key)?.forEach(l => l(v));
  }, [key]);

  return [val, update];
}

export const SETTING_TRYON_ENABLED = "tryon_enabled";
export const SETTING_AUTO_CLEAN = "auto_clean_images";
