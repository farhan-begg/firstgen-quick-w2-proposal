import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import {
  hashWithPepper,
  generateToken,
  generatePasscode,
} from "../_shared/crypto.ts";
import {
  RATE_TOTAL,
  RATE_ER,
  RATE_EE,
  LINK_EXPIRY_DAYS,
  IDEMPOTENCY_WINDOW_SECONDS,
} from "../_shared/constants.ts";

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function env(key: string, fallback?: string): string {
  const val = Deno.env.get(key) ?? fallback;
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

// ---------------------------------------------------------------------------
// Pipedrive helpers
// ---------------------------------------------------------------------------

const PIPEDRIVE_BASE_URL = () =>
  env("PIPEDRIVE_BASE_URL", "https://api.pipedrive.com/v1");
const PIPEDRIVE_API_TOKEN = () => env("PIPEDRIVE_API_TOKEN");

async function updatePipedriveDeal(
  dealId: number,
  fields: Record<string, unknown>
): Promise<void> {
  const url = `${PIPEDRIVE_BASE_URL()}/deals/${dealId}?api_token=${PIPEDRIVE_API_TOKEN()}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipedrive PUT /deals/${dealId} failed (${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Slack helpers
// ---------------------------------------------------------------------------

async function postSlackMessage(
  channel: string,
  text: string
): Promise<void> {
  const token = env("SLACK_BOT_TOKEN");
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack chat.postMessage failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Slack API error: ${json.error}`);
  }
}

/**
 * Look up a Slack user ID by email address.
 * Returns the Slack user ID string (e.g. "U01ABC123") or null if not found.
 * Requires the `users:read.email` scope on the Slack bot.
 */
async function lookupSlackUserByEmail(email: string): Promise<string | null> {
  const token = env("SLACK_BOT_TOKEN");
  const res = await fetch(
    `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.ok || !json.user) return null;
  return json.user.id;
}

// ---------------------------------------------------------------------------
// Pipedrive user helper
// ---------------------------------------------------------------------------

/**
 * Fetch a Pipedrive user's email by their user ID.
 */
async function getPipedriveUserEmail(userId: number): Promise<string | null> {
  const url = `${PIPEDRIVE_BASE_URL()}/users/${userId}?api_token=${PIPEDRIVE_API_TOKEN()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.email || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Formatting helper
// ---------------------------------------------------------------------------

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ------------------------------------------------------------------
    // Step 1: Verify webhook secret
    // ------------------------------------------------------------------
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const expectedSecret = env("PIPEDRIVE_WEBHOOK_SECRET");
    if (secret !== expectedSecret) {
      console.warn("Webhook secret mismatch");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // Step 2: Parse Pipedrive webhook payload
    // ------------------------------------------------------------------
    const payload = await req.json();
    const current = payload.current;
    const previous = payload.previous;

    if (!current || !previous) {
      console.log("No current/previous in payload – ignoring");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dealId: number = current.id;

    // ------------------------------------------------------------------
    // Step 3: Guard against feedback loops
    // Check that generate_proposal changed to "Yes" option ID
    // ------------------------------------------------------------------
    const fieldKey = env("PIPEDRIVE_FIELD_GENERATE_PROPOSAL");
    const yesOptionId = env("PIPEDRIVE_OPTION_GENERATE_YES");

    const currentVal = String(current[fieldKey] ?? "");
    const previousVal = String(previous[fieldKey] ?? "");

    if (currentVal !== yesOptionId || previousVal === yesOptionId) {
      // Either not set to "Yes", or was already "Yes" (no change)
      console.log(
        `generate_proposal not changed to Yes (current=${currentVal}, prev=${previousVal}) – ignoring`
      );
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Processing deal ${dealId}: generate_proposal changed to Yes`);

    // ------------------------------------------------------------------
    // Step 4: Extract deal fields
    // ------------------------------------------------------------------
    const companyName: string = current.title || "";
    const industry: string = String(current[env("PIPEDRIVE_FIELD_INDUSTRY")] ?? "");
    const w2CountRaw = current[env("PIPEDRIVE_FIELD_W2_COUNT")];
    const w2Count: number = w2CountRaw ? Number(w2CountRaw) : 0;
    const taxYear = new Date().getFullYear();
    const pipedriveDealdId = String(dealId);

    // Field keys for writing back to Pipedrive
    const fieldCasePageUrl = env("PIPEDRIVE_FIELD_CASE_PAGE_URL");
    const fieldGenerateProposal = fieldKey;

    // ------------------------------------------------------------------
    // Step 5: Validate required fields
    // ------------------------------------------------------------------
    const missing: string[] = [];
    if (!companyName) missing.push("Deal Title (company name)");
    if (!industry) missing.push("Industry");
    if (!w2Count || w2Count <= 0) missing.push("W-2 Count");

    if (missing.length > 0) {
      const errorMsg = `Missing required fields: ${missing.join(", ")}`;
      console.warn(`Deal ${dealId}: ${errorMsg}`);

      // Reset generate_proposal so staff can fix and re-trigger
      try {
        await updatePipedriveDeal(dealId, {
          [fieldGenerateProposal]: "", // Reset to No / empty
        });
      } catch (e) {
        console.error("Failed to reset generate_proposal:", e);
      }

      return new Response(
        JSON.stringify({ ok: false, error: errorMsg, missing }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------
    // Step 6: Idempotency check
    // ------------------------------------------------------------------
    const supabase = getServiceClient();

    const { data: existingCase } = await supabase
      .from("cases")
      .select("id, last_generated_at")
      .eq("pipedrive_deal_id", pipedriveDealdId)
      .maybeSingle();

    if (existingCase?.last_generated_at) {
      const lastGen = new Date(existingCase.last_generated_at).getTime();
      const now = Date.now();
      if (now - lastGen < IDEMPOTENCY_WINDOW_SECONDS * 1000) {
        console.log(
          `Deal ${dealId}: within idempotency window (${IDEMPOTENCY_WINDOW_SECONDS}s) – skipping`
        );
        return new Response(
          JSON.stringify({
            ok: true,
            skipped: true,
            reason: "idempotency_window",
            case_id: existingCase.id,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // ------------------------------------------------------------------
    // Step 7: Calculate values
    // ------------------------------------------------------------------
    const calcTotal = w2Count * RATE_TOTAL;
    const calcEr = w2Count * RATE_ER;
    const calcEe = w2Count * RATE_EE;

    const calcInputs = {
      w2_count: w2Count,
      tax_year: taxYear,
      rate_total: RATE_TOTAL,
      rate_er: RATE_ER,
      rate_ee: RATE_EE,
    };

    const calcExplanation =
      `Based on ${w2Count} W-2 employees (Tax Year ${taxYear}):\n` +
      `Total Tax Reduction: ${usd(calcTotal)} = Employer Net Savings: ${usd(calcEr)} + Employee Reduction: ${usd(calcEe)}\n` +
      `Per W-2: Total ${usd(RATE_TOTAL)} = ER ${usd(RATE_ER)} + EE ${usd(RATE_EE)}`;

    // ------------------------------------------------------------------
    // Step 8: Upsert case
    // ------------------------------------------------------------------
    const caseRow = {
      pipedrive_deal_id: pipedriveDealdId,
      company_name: companyName,
      industry,
      status: "generated",
      calc_total: calcTotal,
      calc_er: calcEr,
      calc_ee: calcEe,
      calc_inputs: calcInputs,
      calc_explanation: calcExplanation,
      last_generated_at: new Date().toISOString(),
    };

    const { data: upsertedCase, error: upsertError } = await supabase
      .from("cases")
      .upsert(caseRow, { onConflict: "pipedrive_deal_id" })
      .select("id")
      .single();

    if (upsertError || !upsertedCase) {
      console.error("Upsert failed:", upsertError);
      return new Response(
        JSON.stringify({ ok: false, error: "Database upsert failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const caseId: string = upsertedCase.id;
    console.log(`Deal ${dealId}: upserted case ${caseId}`);

    // ------------------------------------------------------------------
    // Step 9: Revoke existing links
    // ------------------------------------------------------------------
    const { error: revokeError } = await supabase
      .from("case_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("case_id", caseId)
      .is("revoked_at", null);

    if (revokeError) {
      console.warn("Failed to revoke old links:", revokeError);
      // Non-fatal — continue
    }

    // ------------------------------------------------------------------
    // Step 10: Generate token + passcode
    // ------------------------------------------------------------------
    const pepper = env("LINK_PEPPER");
    const rawToken = generateToken();
    const rawPasscode = generatePasscode();

    const tokenHash = await hashWithPepper(rawToken, pepper);
    const passcodeHash = await hashWithPepper(rawPasscode, pepper);

    // ------------------------------------------------------------------
    // Step 11: Insert new case_links row
    // ------------------------------------------------------------------
    const expiresAt = new Date(
      Date.now() + LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: linkError } = await supabase.from("case_links").insert({
      case_id: caseId,
      token_hash: tokenHash,
      passcode_hash: passcodeHash,
      expires_at: expiresAt,
    });

    if (linkError) {
      console.error("Failed to insert case_link:", linkError);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to create link" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------
    // Step 12: Build URL
    // ------------------------------------------------------------------
    const appBaseUrl = env("APP_BASE_URL");
    const caseUrl = `${appBaseUrl}/cases/${caseId}?t=${rawToken}`;

    console.log(`Deal ${dealId}: link created – ${caseUrl}`);

    // ------------------------------------------------------------------
    // Step 13: Post Slack message (FIRST — before Pipedrive update)
    // Resolve deal owner to a Slack @mention
    // ------------------------------------------------------------------
    const slackChannel =
      Deno.env.get("SLACK_DEFAULT_CHANNEL") || "";

    if (slackChannel) {
      try {
        // Resolve deal owner → Slack @mention
        let ownerMention = "";
        const dealOwnerId: number | undefined = current.user_id;
        if (dealOwnerId) {
          const ownerEmail = await getPipedriveUserEmail(dealOwnerId);
          if (ownerEmail) {
            const slackUserId = await lookupSlackUserByEmail(ownerEmail);
            if (slackUserId) {
              ownerMention = `<@${slackUserId}>`;
            } else {
              console.warn(`Slack user not found for email: ${ownerEmail}`);
            }
          } else {
            console.warn(`Could not get email for Pipedrive user ${dealOwnerId}`);
          }
        }

        const ownerLine = ownerMention ? `*Deal Owner:* ${ownerMention}\n` : "";

        const slackText =
          `📋 *New Proposal Generated*\n` +
          `${ownerLine}` +
          `*Company:* ${companyName}\n` +
          `*Industry:* ${industry}\n` +
          `*W-2 Count:* ${w2Count}\n` +
          `*Total Tax Reduction:* ${usd(calcTotal)}\n` +
          `*Employer Net Savings:* ${usd(calcEr)}\n` +
          `*Employee Reduction:* ${usd(calcEe)}\n\n` +
          `*Link:* ${caseUrl}\n` +
          `*Passcode:* \`${rawPasscode}\`\n` +
          `_Expires: ${new Date(expiresAt).toLocaleDateString("en-US")}_`;

        await postSlackMessage(slackChannel, slackText);
        console.log(`Deal ${dealId}: Slack message posted`);
      } catch (e) {
        console.error("Slack post failed (non-fatal):", e);
        // Non-fatal — the link is already created
      }
    } else {
      console.warn("No SLACK_DEFAULT_CHANNEL set — skipping Slack post");
    }

    // ------------------------------------------------------------------
    // Step 14: Update Pipedrive deal (try/catch — non-fatal)
    // ------------------------------------------------------------------
    try {
      await updatePipedriveDeal(dealId, {
        [fieldCasePageUrl]: caseUrl,
      });
      console.log(`Deal ${dealId}: Pipedrive updated with case URL`);
    } catch (e) {
      console.error("Pipedrive update failed (non-fatal):", e);
      // Non-fatal — case + link already exist, Slack already posted
    }

    // ------------------------------------------------------------------
    // Step 15: Return success
    // ------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        ok: true,
        case_id: caseId,
        url: caseUrl,
        passcode: rawPasscode,
        expires_at: expiresAt,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
