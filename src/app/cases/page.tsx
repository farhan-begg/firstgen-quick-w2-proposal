import { getSupabaseServiceClient } from "@/lib/supabase";
import CasesTable, { type CaseRow } from "./components/CasesTable";

// ---------------------------------------------------------------------------
// Internal cases list page
// Protected by admin secret in query param (?admin=...)
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

export default async function CasesListPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  const sp = await searchParams;
  const adminSecret = process.env.ADMIN_SECRET;

  // ---- Auth check ----
  if (!sp.admin || sp.admin !== adminSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center max-w-sm">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Unauthorized
          </h1>
          <p className="text-sm text-gray-500">
            A valid admin secret is required to view this page.
          </p>
        </div>
      </div>
    );
  }

  // ---- Fetch cases ----
  const supabase = getSupabaseServiceClient();
  const { data: cases, error } = await supabase
    .from("cases")
    .select(
      "id, created_at, company_name, industry, calc_total, calc_er, calc_ee, status"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch cases:", error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-red-600">Failed to load cases. Check server logs.</p>
      </div>
    );
  }

  const caseRows: CaseRow[] = (cases || []).map((c) => ({
    id: c.id,
    created_at: c.created_at,
    company_name: c.company_name || "",
    industry: c.industry || "",
    calc_total: c.calc_total || 0,
    calc_er: c.calc_er || 0,
    calc_ee: c.calc_ee || 0,
    status: c.status || "unknown",
  }));

  // Extract unique industries for filter dropdown
  const industries = Array.from(
    new Set(caseRows.map((c) => c.industry).filter(Boolean))
  ).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          <p className="text-sm text-gray-500 mt-1">
            Internal dashboard — {caseRows.length} total case{caseRows.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Table */}
        <CasesTable
          cases={caseRows}
          industries={industries}
          adminSecret={sp.admin}
        />
      </div>
    </div>
  );
}
