import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useLanguage } from "../lib/useLanguage";
import { useCurrency } from "../lib/useCurrency";
import { useExchangeRates } from "../lib/useExchangeRates";
import { formatPriceRange } from "../lib/formatPrice";
import { getProducts, deleteProduct, updateProduct, type Product } from "../lib/api";
import { useAdminAuth } from "../lib/useAdminAuth";

export default function Shop() {
  const { lang, setLang } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const rates = useExchangeRates();
  const { authed } = useAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data);
    } catch (err: any) {
      setError("Failed to load products: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      await deleteProduct(productId);
      setProducts(products.filter(p => p.id !== productId));
    } catch (err: any) {
      setError("Failed to delete product: " + err.message);
    }
  };

  const handleEdit = async (productId: string, fields: Partial<Product>) => {
    try {
      await updateProduct(productId, fields);
      setProducts(products.map(p => p.id === productId ? { ...p, ...fields } : p));
    } catch (err: any) {
      setError("Failed to update: " + err.message);
    }
  };

  const convertPrice = (priceInr: string) => {
    // Clean price string: remove currency symbols, commas, whitespace
    const cleaned = (priceInr || "500").replace(/[₹,\s]/g, "");
    let min: number, max: number;
    if (cleaned.includes("–") || cleaned.includes("-")) {
      const parts = cleaned.split(/[–-]/).map(p => parseFloat(p)).filter(n => !isNaN(n));
      min = parts[0] || 500;
      max = parts[1] || min;
    } else {
      const val = parseFloat(cleaned) || 500;
      min = Math.round(val * 0.8);
      max = Math.round(val * 1.2);
    }
    if (currency === "INR") return `₹${min}–${max}`;
    const rate = (rates[currency] || 1) / (rates.INR || 1);
    return formatPriceRange(`${Math.round(min * rate)}–${Math.round(max * rate)}`, currency);
  };

  return (
    <Layout lang={lang} onLangChange={setLang} currency={currency} onCurrencyChange={setCurrency}>
      <main style={{
        flex: 1,
        padding: "20px 16px 40px",
        maxWidth: 1000,
        margin: "0 auto",
        width: "100%",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.8rem",
            color: "var(--ink)"
          }}>
            🛍️ Customer Shop
          </h2>
          {authed && (
            <button
              onClick={loadProducts}
              style={{
                background: "var(--saffron)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              🔄 Refresh
            </button>
          )}
        </div>

        {error && (
          <div style={{
            background: "#ffebee",
            border: "1px solid #f44336",
            borderRadius: 8,
            padding: "12px 16px",
            color: "#c62828",
            marginBottom: 20,
          }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--muted)"
          }}>
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--muted)"
          }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🛒</div>
            <p>No products available yet.</p>
            {authed && <p style={{ marginTop: 8 }}>Add some products from the admin panel!</p>}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
          }}>
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onDelete={authed ? () => handleDelete(product.id) : undefined}
                onEdit={authed ? (fields) => handleEdit(product.id, fields) : undefined}
                convertPrice={convertPrice}
                lang={lang}
              />
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}

function ProductCard({
  product,
  onDelete,
  onEdit,
  convertPrice,
  lang
}: {
  product: Product;
  onDelete?: () => void;
  onEdit?: (fields: Partial<Product>) => void;
  convertPrice: (price: string) => string;
  lang: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [category, setCategory] = useState(product.category);
  const [priceInr, setPriceInr] = useState(product.price_inr);
  const [dimensions, setDimensions] = useState(product.dimensions);
  const [tagsStr, setTagsStr] = useState(product.tags.join(", "));

  const handleSave = () => {
    const tags = tagsStr.split(/[,;]+/).map(t => t.trim().replace(/^#/, "")).filter(Boolean);
    onEdit?.({ name, description, category, price_inr: priceInr, dimensions, tags });
    setEditing(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "6px 8px", borderRadius: 6,
    border: "1.5px solid var(--border)", fontSize: "0.82rem",
    fontFamily: "inherit", background: "#faf6ef", marginBottom: 6,
  };

  return (
    <div style={{
      background: "var(--card)",
      border: "1.5px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Admin action buttons */}
      {(onDelete || onEdit) && (
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", gap: 6 }}>
          {onEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              style={{
                background: "var(--saffron)", border: "none", borderRadius: "50%",
                width: 32, height: 32, color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem",
              }}
              title="Edit product"
            >✏️</button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              style={{
                background: "#f44336", border: "none", borderRadius: "50%",
                width: 32, height: 32, color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
              }}
              title="Delete product"
            >×</button>
          )}
        </div>
      )}

      <div style={{
        width: "100%", height: 200, background: "#f5f5f5",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        <img
          src={`data:${product.imageMime};base64,${product.image}`}
          alt={product.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div style={{ padding: 16 }}>
        {editing ? (
          /* ── Edit mode ── */
          <>
            <label style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />

            <label style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} style={{ ...inputStyle, resize: "vertical" }} />

            <label style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)} style={inputStyle} />

            <label style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Price (INR)</label>
            <input value={priceInr} onChange={e => setPriceInr(e.target.value)} style={inputStyle} />

            <label style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Dimensions</label>
            <input value={dimensions} onChange={e => setDimensions(e.target.value)} style={inputStyle} />

            <label style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Tags (comma-separated)</label>
            <input value={tagsStr} onChange={e => setTagsStr(e.target.value)}
              placeholder="automotive, diagnostic, OBD2" style={inputStyle} />

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={handleSave} style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "none",
                background: "#2e7d32", color: "#fff", fontWeight: 700, cursor: "pointer",
              }}>💾 Save</button>
              <button onClick={() => setEditing(false)} style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "1.5px solid var(--border)",
                background: "var(--card)", color: "var(--ink)", cursor: "pointer",
              }}>Cancel</button>
            </div>
          </>
        ) : (
          /* ── View mode ── */
          <>
            <h3 style={{
              fontFamily: "'Playfair Display', serif", fontSize: "1.1rem",
              color: "var(--ink)", marginBottom: 8, lineHeight: 1.3,
            }}>{product.name}</h3>

            <p style={{
              color: "var(--muted)", fontSize: "0.85rem",
              marginBottom: 12, lineHeight: 1.4,
            }}>{product.description}</p>

            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 8,
            }}>
              <span style={{ fontSize: "0.9rem", color: "var(--ink)", fontWeight: 600 }}>
                {convertPrice(product.price_inr)}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {product.category}
              </span>
            </div>

            {product.dimensions !== "—" && product.dimensions !== "Standard" && (
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 8 }}>
                📏 {product.dimensions}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {product.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: "0.7rem", background: "#f0f0f0", color: "var(--ink)",
                  padding: "2px 8px", borderRadius: 12, border: "1px solid var(--border)",
                }}>#{tag}</span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
