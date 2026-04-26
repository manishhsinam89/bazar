import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useLanguage } from "../lib/useLanguage";
import { useCurrency } from "../lib/useCurrency";
import { useExchangeRates } from "../lib/useExchangeRates";
import { formatPriceRange } from "../lib/formatPrice";
import { getProducts, deleteProduct, type Product } from "../lib/api";
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

  const convertPrice = (priceInr: string) => {
    if (currency === "INR") return `₹${priceInr}`;

    const [min, max] = priceInr.split("–").map(p => parseFloat(p));
    const avgPrice = (min + max) / 2;
    const converted = avgPrice * (rates[currency] / rates.INR);

    return formatPriceRange(`${Math.round(converted * 0.8)}–${Math.round(converted * 1.2)}`, currency);
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
  convertPrice,
  lang
}: {
  product: Product;
  onDelete?: () => void;
  convertPrice: (price: string) => string;
  lang: string;
}) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1.5px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
    }}>
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "#f44336",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            color: "#fff",
            cursor: "pointer",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1rem",
          }}
          title="Delete product"
        >
          ×
        </button>
      )}

      <div style={{
        width: "100%",
        height: 200,
        background: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}>
        <img
          src={`data:${product.imageMime};base64,${product.image}`}
          alt={product.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      <div style={{ padding: 16 }}>
        <h3 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "1.1rem",
          color: "var(--ink)",
          marginBottom: 8,
          lineHeight: 1.3,
        }}>
          {product.name}
        </h3>

        <p style={{
          color: "var(--muted)",
          fontSize: "0.85rem",
          marginBottom: 12,
          lineHeight: 1.4,
        }}>
          {product.description}
        </p>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}>
          <span style={{
            fontSize: "0.9rem",
            color: "var(--ink)",
            fontWeight: 600,
          }}>
            {convertPrice(product.price_inr)}
          </span>
          <span style={{
            fontSize: "0.75rem",
            color: "var(--muted)",
          }}>
            {product.category}
          </span>
        </div>

        {product.dimensions !== "—" && (
          <div style={{
            fontSize: "0.8rem",
            color: "var(--muted)",
            marginBottom: 8,
          }}>
            📏 {product.dimensions}
          </div>
        )}

        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
        }}>
          {product.tags.map(tag => (
            <span
              key={tag}
              style={{
                fontSize: "0.7rem",
                background: "#f0f0f0",
                color: "var(--ink)",
                padding: "2px 8px",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
