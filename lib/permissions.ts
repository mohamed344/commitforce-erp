/**
 * Effective per-module permissions for the signed-in user.
 *
 * Permissions are stored as "<moduleKey>:<action>" strings on the user's
 * `company_roles.permissions` array (migration 34), linked through
 * `user_roles.company_role_id` (migration 28). Company admins
 * (`profiles.role = 'admin'`) bypass the checks entirely.
 *
 * Server-only, defensive like lib/settings.ts: any missing table/row/column
 * (migrations not applied, user signed out, no role assigned) resolves to
 * "no extra access" rather than throwing, so pages keep rendering.
 */
import "server-only";
import { createClient } from "@/utils/supabase/server";

/** Gate flags for the bon de commande (chiffrage) workflow. */
export type SalesAccess = {
  /** Can create chiffrage bons de commande and add product lines. */
  canCreate: boolean;
  /** Can run the stock review and generate the bon d'achat. */
  canReview: boolean;
};

/** Read the current user's effective sales permissions. */
export async function getSalesAccess(): Promise<SalesAccess> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { canCreate: false, canReview: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  // Admins can do everything.
  if (profile?.role === "admin") return { canCreate: true, canReview: true };

  const companyId = profile?.company_id ?? null;
  if (!companyId) return { canCreate: false, canReview: false };

  // user_roles → company_role_id → company_roles.permissions
  let perms: string[] = [];
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role:company_roles(permissions)")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .maybeSingle();
    const role = (data as { role: { permissions: string[] | null } | null } | null)?.role;
    perms = role?.permissions ?? [];
  } catch {
    perms = [];
  }

  return {
    canCreate: perms.includes("sales:create"),
    canReview: perms.includes("sales:edit"),
  };
}
