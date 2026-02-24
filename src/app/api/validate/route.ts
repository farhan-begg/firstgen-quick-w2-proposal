import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { hashWithPepper } from "@/lib/crypto";

/**
 * Token-only validation for public proposal links.
 * No passcode needed — just validates token, checks expiry/revocation,
 * increments view count, and returns case data.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { case_id?: string; token?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, state: "invalid", error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { case_id, token } = body;

    if (!case_id || !token) {
      return NextResponse.json(
        { ok: false, state: "invalid" },
        { status: 400 }
      );
    }

    const pepper = process.env.LINK_PEPPER;
    if (!pepper) {
      console.error("LINK_PEPPER is not set");
      return NextResponse.json(
        { ok: false, state: "invalid", error: "Server config error" },
        { status: 500 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const tokenHash = hashWithPepper(token, pepper);

    // Look up link by token hash and case_id
    const { data: link, error: linkError } = await supabase
      .from("case_links")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("case_id", case_id)
      .maybeSingle();

    if (linkError) {
      console.error("DB lookup error:", linkError);
      return NextResponse.json({ ok: false, state: "invalid" }, { status: 500 });
    }

    if (!link) {
      return NextResponse.json({ ok: false, state: "invalid" }, { status: 200 });
    }

    // Check revoked
    if (link.revoked_at) {
      return NextResponse.json({ ok: false, state: "revoked" }, { status: 200 });
    }

    // Check expired
    if (new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, state: "expired" }, { status: 200 });
    }

    // Increment view count
    await supabase
      .from("case_links")
      .update({
        view_count: (link.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    // Fetch case data
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select(
        "id, company_name, industry, calc_total, calc_er, calc_ee, calc_inputs, calc_explanation, status"
      )
      .eq("id", case_id)
      .single();

    if (caseError || !caseData) {
      console.error("Case lookup failed:", caseError);
      return NextResponse.json({ ok: false, state: "invalid" }, { status: 200 });
    }

    return NextResponse.json({
      ok: true,
      state: "success",
      data: caseData,
    });
  } catch (err) {
    console.error("Unhandled error in /api/validate:", err);
    return NextResponse.json({ ok: false, state: "invalid" }, { status: 500 });
  }
}
