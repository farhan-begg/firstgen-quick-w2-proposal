import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import {
  hashWithPepper,
  generateToken,
  generatePasscode,
} from "../_shared/crypto.ts";
import { LINK_EXPIRY_DAYS } from "../_shared/constants.ts";

// ---------------------------------------------------------------------------
// Env helper
// ---------------------------------------------------------------------------

function env(key: string, fallback?: string): string {
  const val = Deno.env.get(key) ?? fallback;
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Pipedrive helper
// ---------------------------------------------------------------------------

async function updatePipedriveDeal(
  dealId: number,
  fields: Record<string, unknown>
): Promise<void> {
  const baseUrl = env("PIPEDRIVE_BASE_URL", "https://api.pipedrive.com/v1");
  const token = env("PIPEDRIVE_API_TOKEN");
  const url = `${baseUrl}/deals/${dealId}?api_token=${token}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipedrive PUT failed (${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { case_id } = await req.json();

    if (!case_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "case_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();
    const pepper = env("LINK_PEPPER");
    const appBaseUrl = env("APP_BASE_URL");

    // ------------------------------------------------------------------
    // Verify case exists and get pipedrive_deal_id
    // ------------------------------------------------------------------
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("id, pipedrive_deal_id")
      .eq("id", case_id)
      .single();

    if (caseError || !caseData) {
      return new Response(
        JSON.stringify({ ok: false, error: "Case not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------
    // Revoke existing links
    // ------------------------------------------------------------------
    await supabase
      .from("case_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("case_id", case_id)
      .is("revoked_at", null);

    // ------------------------------------------------------------------
    // Generate new token + passcode
    // ------------------------------------------------------------------
    const rawToken = generateToken();
    const rawPasscode = generatePasscode();
    const tokenHash = await hashWithPepper(rawToken, pepper);
    const passcodeHash = await hashWithPepper(rawPasscode, pepper);

    const expiresAt = new Date(
      Date.now() + LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // ------------------------------------------------------------------
    // Insert new case_links row
    // ------------------------------------------------------------------
    const { error: linkError } = await supabase.from("case_links").insert({
      case_id,
      token_hash: tokenHash,
      passcode_hash: passcodeHash,
      expires_at: expiresAt,
    });

    if (linkError) {
      console.error("Failed to insert case_link:", linkError);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to create link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------
    // Build URL
    // ------------------------------------------------------------------
    const caseUrl = `${appBaseUrl}/cases/${case_id}?t=${rawToken}`;

    // ------------------------------------------------------------------
    // Update case last_generated_at
    // ------------------------------------------------------------------
    await supabase
      .from("cases")
      .update({ last_generated_at: new Date().toISOString() })
      .eq("id", case_id);

    // ------------------------------------------------------------------
    // Update Pipedrive (non-fatal)
    // ------------------------------------------------------------------
    const pipedriveDealdId = Number(caseData.pipedrive_deal_id);
    if (pipedriveDealdId) {
      try {
        const fieldCasePageUrl = env("PIPEDRIVE_FIELD_CASE_PAGE_URL");
        const fieldCaseGeneratedAt = env("PIPEDRIVE_FIELD_CASE_GENERATED_AT");
        await updatePipedriveDeal(pipedriveDealdId, {
          [fieldCasePageUrl]: caseUrl,
          [fieldCaseGeneratedAt]: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Pipedrive update failed (non-fatal):", e);
      }
    }

    // ------------------------------------------------------------------
    // Return — no Slack post for regeneration
    // ------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        ok: true,
        case_id,
        url: caseUrl,
        passcode: rawPasscode,
        expires_at: expiresAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
