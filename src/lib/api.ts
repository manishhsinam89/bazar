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

export async function addProduct(product: Omit<Product, "id">): Promise<Product> {
  const response = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  if (!response.ok) throw new Error("Failed to add product");
  return response.json();
}

export async function getProducts(): Promise<Product[]> {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error("Failed to fetch products");
  return response.json();
}

export async function deleteProduct(productId: string): Promise<void> {
  const response = await fetch(`/api/products/${productId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete product");
}
