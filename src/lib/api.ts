import { supabase } from "./supabase";

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  dimensions: string;
  price_inr: string;
  tags: string[];
  image: string;
  imageMime: string;
  postedAt: string;
}

// ── Supabase DB (shared across all devices) with localStorage fallback ──

const STORAGE_KEY = "bazar_products";

function readLocal(): Product[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function writeLocal(products: Product[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export async function addProduct(product: Omit<Product, "id">): Promise<Product> {
  if (supabase) {
    const { data, error } = await supabase.from("products").insert({
      name: product.name,
      description: product.description,
      category: product.category,
      dimensions: product.dimensions,
      price_inr: product.price_inr,
      tags: product.tags,
      image: product.image,
      image_mime: product.imageMime,
      posted_at: product.postedAt || new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  }
  // fallback
  const np: Product = { ...product, id: crypto.randomUUID?.() || Date.now().toString(36) };
  const all = readLocal(); all.unshift(np); writeLocal(all);
  return np;
}

export async function getProducts(): Promise<Product[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("posted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  }
  return readLocal();
}

export async function deleteProduct(productId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) throw new Error(error.message);
    return;
  }
  writeLocal(readLocal().filter(p => p.id !== productId));
}

/** Map Supabase snake_case row → camelCase Product */
function mapRow(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    dimensions: row.dimensions,
    price_inr: row.price_inr,
    tags: row.tags || [],
    image: row.image,
    imageMime: row.image_mime,
    postedAt: row.posted_at,
  };
}
