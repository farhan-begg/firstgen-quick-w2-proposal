import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { hashWithPepper, generateToken } from "@/lib/crypto";
import { LINK_EXPIRY_DAYS } from "@/lib/constants";
import { calculateSavings, validateInput } from "@/lib/calculator";

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // ---- Auth check ----
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ---- Parse & validate input ----
    let body: { company_name?: string; industry?: string; w2_count?: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { company_name, industry, w2_count } = body;

    const missing = validateInput({ company_name, industry, w2_count });
    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Missing or invalid fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // ---- Calculate ----
    const savings = calculateSavings(w2_count!);

    // ---- Insert case ----
    const { data: newCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        user_id: user.id,
        company_name: company_name!.trim(),
        industry: industry!.trim(),
        status: "generated",
        ...savings,
        last_generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (caseError || !newCase) {
      console.error("Failed to insert case:", caseError);
      return NextResponse.json(
        { ok: false, error: "Failed to create proposal" },
        { status: 500 }
      );
    }

    // ---- Generate token & create link ----
    const pepper = process.env.LINK_PEPPER;
    if (!pepper) {
      console.error("LINK_PEPPER is not set");
      return NextResponse.json(
        { ok: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const rawToken = generateToken();
    const tokenHash = hashWithPepper(rawToken, pepper);

    const expiresAt = new Date(
      Date.now() + LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // ---- Build URL ----
    const appBaseUrl =
      process.env.APP_BASE_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : "http://localhost:3000");
    const caseUrl = `${appBaseUrl}/cases/${newCase.id}?t=${rawToken}`;

    const { error: linkError } = await supabase.from("case_links").insert({
      case_id: newCase.id,
      token_hash: tokenHash,
      passcode_hash: "",
      expires_at: expiresAt,
      shareable_url: caseUrl,
    });

    if (linkError) {
      console.error("Failed to insert case_link:", linkError);
      // Clean up the case since link creation failed
      await supabase.from("cases").delete().eq("id", newCase.id);
      return NextResponse.json(
        { ok: false, error: "Failed to create link" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      case_id: newCase.id,
      url: caseUrl,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("Unhandled error in /api/generate:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
