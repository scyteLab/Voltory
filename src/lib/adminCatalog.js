import { supabase } from "./supabaseClient.js";

/**
 * Thin wrappers around the products/categories/brands tables —
 * the admin equivalent of utils/orders.js's localStorage wrappers,
 * except this is a real, shared database.
 */
export async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("label");
  if (error) throw error;
  return data;
}

export async function fetchBrands() {
  const { data, error } = await supabase.from("brands").select("*").order("name");
  if (error) throw error;
  return data;
}

/** Insert (new sku) or update (existing sku) — same shape either way. */
export async function saveProduct(product) {
  const { data, error } = await supabase
    .from("products")
    .upsert(product)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(sku) {
  const { error } = await supabase.from("products").delete().eq("sku", sku);
  if (error) throw error;
}
