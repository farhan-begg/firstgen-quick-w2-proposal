import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { hashWithPepper } from "../_shared/crypto.ts";
import { MAX_ATTEMPTS, LOCK_DURATION_MINUTES } from "../_shared/constants.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccessState =
  | "success"
  | "invalid"
  | "expired"
  | "revoked"
  | "locked"
  | "wrong_passcode";

interface AccessResponse {
  ok: boolean;
  state: AccessState;
  data?: Record<string, unknown>;
  remaining_attempts?: number;
}

// ---------------------------------------------------------------------------
// Env helper
// ---------------------------------------------------------------------------

function env(key: string): string {
  const val = Deno.env.get(key);
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

// ---------------------------------------------------------------------------
// CORS headers (allow browser calls from Next.js)
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
      JSON.stringify({ ok: false, state: "invalid", error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // ------------------------------------------------------------------
    // Step 1: Parse input
    // ------------------------------------------------------------------
    const { case_id, token, passcode } = await req.json();

    if (!case_id || !token || !passcode) {
      return jsonResponse({ ok: false, state: "invalid" as AccessState }, 400);
    }

    const pepper = env("LINK_PEPPER");
    const supabase = getServiceClient();

    // ------------------------------------------------------------------
    // Step 2: Hash token and look up case_links row
    // ------------------------------------------------------------------
    const tokenHash = await hashWithPepper(token, pepper);

    const { data: link, error: linkError } = await supabase
      .from("case_links")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("case_id", case_id)
      .maybeSingle();

    if (linkError) {
      console.error("DB lookup error:", linkError);
      return jsonResponse({ ok: false, state: "invalid" as AccessState }, 500);
    }

    if (!link) {
      return jsonResponse({ ok: false, state: "invalid" as AccessState }, 200);
    }

    // ------------------------------------------------------------------
    // Step 3: Check lifecycle — revoked, expired, locked
    // ------------------------------------------------------------------
    if (link.revoked_at) {
      return jsonResponse({ ok: false, state: "revoked" as AccessState }, 200);
    }

    const now = new Date();

    if (new Date(link.expires_at) < now) {
      return jsonResponse({ ok: false, state: "expired" as AccessState }, 200);
    }

    if (link.locked_until && new Date(link.locked_until) > now) {
      const unlockAt = new Date(link.locked_until).toISOString();
      return jsonResponse(
        { ok: false, state: "locked" as AccessState },
        200,
        { locked_until: unlockAt }
      );
    }

    // ------------------------------------------------------------------
    // Step 4: Hash passcode and compare
    // ------------------------------------------------------------------
    const passcodeHash = await hashWithPepper(String(passcode), pepper);
    const isCorrect = passcodeHash === link.passcode_hash;

    // ------------------------------------------------------------------
    // Step 5: Wrong passcode — increment attempts, maybe lock
    // ------------------------------------------------------------------
    if (!isCorrect) {
      const newAttemptCount = (link.attempt_count || 0) + 1;
      const updates: Record<string, unknown> = {
        attempt_count: newAttemptCount,
      };

      if (newAttemptCount >= MAX_ATTEMPTS) {
        updates.locked_until = new Date(
          Date.now() + LOCK_DURATION_MINUTES * 60 * 1000
        ).toISOString();
      }

      await supabase
        .from("case_links")
        .update(updates)
        .eq("id", link.id);

      if (newAttemptCount >= MAX_ATTEMPTS) {
        return jsonResponse({ ok: false, state: "locked" as AccessState }, 200);
      }

      return jsonResponse(
        {
          ok: false,
          state: "wrong_passcode" as AccessState,
          remaining_attempts: MAX_ATTEMPTS - newAttemptCount,
        },
        200
      );
    }

    // ------------------------------------------------------------------
    // Step 6: Correct — reset attempts, increment view count
    // ------------------------------------------------------------------
    await supabase
      .from("case_links")
      .update({
        attempt_count: 0,
        view_count: (link.view_count || 0) + 1,
        last_viewed_at: now.toISOString(),
      })
      .eq("id", link.id);

    // ------------------------------------------------------------------
    // Step 7: Fetch case data and return payload
    // ------------------------------------------------------------------
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select(
        "id, company_name, industry, calc_total, calc_er, calc_ee, calc_inputs, calc_explanation, status"
      )
      .eq("id", case_id)
      .single();

    if (caseError || !caseData) {
      console.error("Case lookup failed:", caseError);
      return jsonResponse({ ok: false, state: "invalid" as AccessState }, 200);
    }

    return jsonResponse(
      {
        ok: true,
        state: "success" as AccessState,
        data: caseData,
      },
      200
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return jsonResponse({ ok: false, state: "invalid" as AccessState }, 500);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  body: AccessResponse,
  status: number,
  extra?: Record<string, unknown>
): Response {
  return new Response(JSON.stringify({ ...body, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
