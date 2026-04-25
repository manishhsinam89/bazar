import { useState, useRef, useCallback } from "react";
import { analyzeProduct } from "../lib/claude";
import { addProduct, type Product } from "../lib/api";
import { Toast, type ToastHandle } from "../components/Toast";
import Layout from "../components/Layout";
import AdminGate from "../components/AdminGate";
import ImageCropper, { type CropBox } from "../components/ImageCropper";
import { useAdminAuth } from "../lib/useAdminAuth";
import { useLanguage, LANGUAGES } from "../lib/useLanguage";
import { useCurrency } from "../lib/useCurrency";
import { useExchangeRates } from "../lib/useExchangeRates";
import { formatPriceRange } from "../lib/formatPrice";
import { cleanImage } from "../lib/imageClean";
import { useSetting, SETTING_AUTO_CLEAN } from "../lib/useSetting";

type ProductData = Omit<Product, "id">;

const camBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 8,
  color: "#e8c080",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "6px 12px",
  cursor: "pointer",
  transition: "background 0.2s",
};

const miniBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 6,
  color: "#e8c080",
  fontSize: "0.7rem",
  fontWeight: 600,
  padding: "4px 8px",
  cursor: "pointer",
};

const spinnerStyle: React.CSSProperties = {
  display: "inline-block",
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.2)",
  borderTopColor: "var(--saffron)",
  animation: "spin 0.8s linear infinite",
};

export default function AddProduct() {
  const { authed, login, logout, error: authError } = useAdminAuth();
  const { lang, setLang } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const rates = useExchangeRates();
  const langName = LANGUAGES.find(l => l.code === lang)?.name ?? "English";
  const [autoClean, setAutoClean] = useSetting<boolean>(SETTING_AUTO_CLEAN, true);
  const [rawBase64, setRawBase64] = useState<string | null>(null);  // original photo, unmodified
  const [rawMime, setRawMime] = useState("image/jpeg");
  const [imageBase64, setImageBase64] = useState<string | null>(null); // cleaned version used for upload
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, w: 1, h: 1 });
  const [showCropper, setShowCropper] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductData | null>(null);

  const processNewPhoto = useCallback(async (b64: string, mime: string) => {
    setRawBase64(b64);
    setRawMime(mime);
    setCropBox({ x: 0, y: 0, w: 1, h: 1 });
    setShowCropper(false);
    setCleaning(true);
    try {
      if (autoClean) {
        const cleaned = await cleanImage(b64, { background: "#ffffff", square: true, trim: true });
        setImageBase64(cleaned.base64);
        setImageMime(cleaned.mime);
        if (cleaned.trimmed) toastRef.current?.show("✨ Cleaned: borders trimmed");
      } else {
        setImageBase64(b64);
        setImageMime(mime);
      }
    } catch (err: any) {
      console.error(err);
      setImageBase64(b64);
      setImageMime(mime);
    } finally {
      setCleaning(false);
    }
  }, [autoClean]);

  const reapplyCrop = useCallback(async () => {
    if (!rawBase64) return;
    setCleaning(true);
    try {
      const cleaned = await cleanImage(rawBase64, {
        background: "#ffffff", square: true, trim: false, cropBox,
      });
      setImageBase64(cleaned.base64);
      setImageMime(cleaned.mime);
      setShowCropper(false);
      toastRef.current?.show("✂️ Cropped");
    } catch (err: any) {
      setError("Crop failed: " + err.message);
    } finally {
      setCleaning(false);
    }
  }, [rawBase64, cropBox]);

  const resetToOriginal = useCallback(async () => {
    if (!rawBase64) return;
    setCleaning(true);
    try {
      const cleaned = await cleanImage(rawBase64, {
        background: "#ffffff", square: true, trim: autoClean,
      });
      setImageBase64(cleaned.base64);
      setImageMime(cleaned.mime);
      setCropBox({ x: 0, y: 0, w: 1, h: 1 });
      setShowCropper(false);
    } finally {
      setCleaning(false);
    }
  }, [rawBase64, autoClean]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastRef = useRef<ToastHandle>(null);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      fileInputRef.current?.click();
    }
  }, []);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  }, [stream]);

  const handleZoneClick = () => {
    if (!stream && !captured) startCamera();
  };

  const handleSnap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const data = c.toDataURL("image/jpeg", 0.92);
    const b64 = data.split(",")[1];
    setCaptured(true);
    stopStream();
    void processNewPhoto(b64, "image/jpeg");
  };

  const handleRetake = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCaptured(false);
    setImageBase64(null);
    setRawBase64(null);
    setShowCropper(false);
    setProduct(null);
    setError(null);
    setPosted(false);
    startCamera();
  };

  const handleGallery = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type || "image/jpeg";
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result as string;
      const b64 = data.split(",")[1];
      setCaptured(true);
      stopStream();
      void processNewPhoto(b64, mime);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAnalyse = async () => {
    if (!imageBase64) return;
    setAnalysing(true);
    setError(null);
    setProduct(null);
    setPosted(false);
    try {
      const result = await analyzeProduct(imageBase64, imageMime, lang);
      setProduct({ ...result, image: imageBase64, imageMime, postedAt: new Date().toISOString() });
    } catch (err: any) {
      setError("Analysis failed: " + err.message + ". You can still post manually.");
      setProduct({
        name: "Product", description: "Handcrafted item", category: "Handicraft",
        dimensions: "—", price_inr: "200–500", tags: ["handmade"],
        image: imageBase64, imageMime, postedAt: new Date().toISOString(),
      });
    } finally {
      setAnalysing(false);
    }
  };

  const handlePost = async () => {
    if (!product) return;
    setPosting(true);
    setError(null);
    try {
      await addProduct(product);
      toastRef.current?.show("✅ Posted to shop!");
      setPosted(true);
    } catch (err: any) {
      setError("Post failed: " + err.message);
    } finally {
      setPosting(false);
    }
  };

  const updateField = <K extends keyof ProductData>(key: K, value: ProductData[K]) => {
    setProduct(p => p ? { ...p, [key]: value } : p);
  };

  const previewSrc = imageBase64 ? `data:${imageMime};base64,${imageBase64}` : null;

  if (!authed) {
    return (
      <Layout lang={lang} onLangChange={setLang} currency={currency} onCurrencyChange={setCurrency}>
        <AdminGate error={authError} onLogin={login} />
      </Layout>
    );
  }

  return (
    <Layout onLogout={logout} lang={lang} onLangChange={setLang} currency={currency} onCurrencyChange={setCurrency}>
      <main style={{
        flex: 1, padding: "20px 16px 40px",
        maxWidth: 520, margin: "0 auto", width: "100%",
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* CAMERA SECTION */}
        <div style={{
          background: "var(--card)", border: "1.5px solid var(--border)",
          borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12,
        }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", color: "var(--ink)", marginBottom: 4 }}>
            📸 Product Photo
          </h3>

          <div
            onClick={handleZoneClick}
            style={{
              borderRadius: 12, overflow: "hidden", background: "var(--ink)",
              position: "relative", minHeight: 240,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: stream || captured ? "default" : "pointer",
            }}
          >
            {!stream && !captured && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 12, padding: "36px 24px", color: "#c09060",
              }}>
                <div style={{ fontSize: "3rem" }}>📷</div>
                <strong style={{ color: "#e8c080", fontSize: "0.95rem" }}>Tap to add photo</strong>
                <span style={{ fontSize: "0.75rem", textAlign: "center", lineHeight: 1.5 }}>Camera or gallery</span>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: stream ? "block" : "none" }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {previewSrc && (
              <img
                src={previewSrc}
                alt="product"
                style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: captured ? "block" : "none" }}
              />
            )}

            {(stream || captured) && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: "absolute", bottom: 12, left: "50%",
                  transform: "translateX(-50%)", display: "flex", gap: 12,
                }}
              >
                {stream && (
                  <>
                    <button onClick={handleGallery} style={camBtnStyle}>🖼 Gallery</button>
                    <button onClick={handleSnap} style={{ ...camBtnStyle, background: "var(--saffron)", borderColor: "var(--saffron)" }}>⏺ Snap</button>
                  </>
                )}
                {captured && (
                  <button onClick={handleRetake} style={camBtnStyle}>↺ Retake</button>
                )}
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

          {/* Cleanup status / controls */}
          {captured && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
              padding: "8px 2px 0", fontSize: "0.74rem", color: "var(--muted)",
            }}>
              {cleaning ? (
                <><div style={{ ...spinnerStyle, borderTopColor: "var(--saffron)" }} /> Processing photo…</>
              ) : (
                <>
                  <span>🧼 Auto-clean</span>
                  <button
                    onClick={() => setAutoClean(!autoClean)}
                    style={{
                      width: 36, height: 20, borderRadius: 10,
                      background: autoClean ? "var(--saffron)" : "#d6c4a4",
                      border: "none", position: "relative", cursor: "pointer",
                    }}
                    aria-pressed={autoClean}
                    title="Auto-trim borders, rotate, and shrink"
                  >
                    <span style={{
                      position: "absolute", top: 2, left: autoClean ? 18 : 2,
                      width: 16, height: 16, borderRadius: "50%",
                      background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                      transition: "left .15s",
                    }} />
                  </button>
                  <span style={{ flex: 1 }} />
                  {!showCropper ? (
                    <button onClick={() => setShowCropper(true)} style={miniBtn}>✂️ Crop / Fix</button>
                  ) : (
                    <>
                      <button onClick={resetToOriginal} style={miniBtn}>Cancel</button>
                      <button onClick={reapplyCrop} style={{ ...miniBtn, background: "var(--saffron)", borderColor: "var(--saffron)", color: "#fff" }}>Apply Crop</button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Cropper modal */}
          {captured && showCropper && rawBase64 && (
            <div style={{ marginTop: 10 }}>
              <ImageCropper
                src={`data:${rawMime};base64,${rawBase64}`}
                value={cropBox}
                onChange={setCropBox}
                aspect="square"
              />
              <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 6, textAlign: "center" }}>
                Drag to remove extra hands, fingers or messy backgrounds. Tap <strong>Apply Crop</strong> when ready.
              </p>
            </div>
          )}
        </div>

        {/* ANALYSE BUTTON */}
      </main>
    </Layout>
  );
}
