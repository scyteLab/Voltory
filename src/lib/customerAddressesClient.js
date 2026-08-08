import { supabase, supabaseConfigured } from "./supabaseClient.js";

/**
 * customerAddressesClient
 *
 * CRUD for the customer_addresses table, from the customer's own
 * (storefront) session. All queries are keyed on customer_id so the
 * customer only ever sees their own addresses.
 *
 * Interim RLS: customer_addresses has permissive select+write policies
 * from Session 30 (same posture as customers/orders). Session 32c will
 * tighten to auth.uid()-based. In the meantime, we filter every query
 * by customer_id client-side.
 */

/**
 * Fetch every saved address for this customer. Sorted with default
 * first (if any), then by most recently added.
 */
export async function fetchAddresses(customerId) {
  if (!customerId) return { ok: true, addresses: [] };
  if (!supabaseConfigured) return { ok: true, addresses: [] };

  try {
    const { data, error } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[addresses] fetch failed:", error);
      return { ok: false, error: error.message, addresses: [] };
    }
    return { ok: true, addresses: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), addresses: [] };
  }
}

function validate(input) {
  if (!input.state?.trim()) return "State is required";
  if (!input.lga?.trim()) return "LGA / City is required";
  if (!input.street?.trim()) return "Street address is required";
  if (input.street.trim().length < 5) return "Street address seems too short \u2014 include a house number and street name";
  return null;
}

/**
 * Create a new address for this customer.
 * If `is_default=true`, unset every other address's default first
 * (so there's always exactly zero or one default).
 */
export async function createAddress(customerId, input) {
  if (!customerId) return { ok: false, error: "Not signed in" };
  const validErr = validate(input);
  if (validErr) return { ok: false, error: validErr };

  try {
    if (input.is_default) {
      await supabase
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("customer_id", customerId);
    }

    const row = {
      customer_id: customerId,
      label:    input.label?.trim() || null,
      name:     input.name?.trim() || null,
      phone:    input.phone?.trim() || null,
      state:    input.state.trim(),
      lga:      input.lga.trim(),
      street:   input.street.trim(),
      landmark: input.landmark?.trim() || null,
      is_default: !!input.is_default,
    };

    const { data, error } = await supabase
      .from("customer_addresses")
      .insert(row)
      .select()
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[addresses] create failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, address: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Update an existing address. Enforces customer_id match on the
 * update so a customer can't modify someone else's row even if
 * they knew the id.
 */
export async function updateAddress(customerId, id, patch) {
  if (!customerId || !id) return { ok: false, error: "Missing identifier" };
  const validErr = validate(patch);
  if (validErr) return { ok: false, error: validErr };

  try {
    if (patch.is_default) {
      await supabase
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("customer_id", customerId)
        .neq("id", id);
    }

    const clean = {
      label:    patch.label?.trim() || null,
      name:     patch.name?.trim() || null,
      phone:    patch.phone?.trim() || null,
      state:    patch.state.trim(),
      lga:      patch.lga.trim(),
      street:   patch.street.trim(),
      landmark: patch.landmark?.trim() || null,
      is_default: !!patch.is_default,
    };

    const { data, error } = await supabase
      .from("customer_addresses")
      .update(clean)
      .eq("id", id)
      .eq("customer_id", customerId) // belt+braces
      .select()
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[addresses] update failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, address: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Set an address as the default. Zeros every other one for the
 * same customer, then flips this one on.
 */
export async function setDefaultAddress(customerId, id) {
  if (!customerId || !id) return { ok: false, error: "Missing identifier" };
  try {
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", customerId);

    const { data, error } = await supabase
      .from("customer_addresses")
      .update({ is_default: true })
      .eq("id", id)
      .eq("customer_id", customerId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, address: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Delete an address.
 */
export async function deleteAddress(customerId, id) {
  if (!customerId || !id) return { ok: false, error: "Missing identifier" };
  try {
    const { error } = await supabase
      .from("customer_addresses")
      .delete()
      .eq("id", id)
      .eq("customer_id", customerId);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[addresses] delete failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}