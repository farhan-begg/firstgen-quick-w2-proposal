import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSupabaseServerClient, getAuthUser } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/format";
import SignOutButton from "./SignOutButton";
import CopyLinkButton from "./CopyLinkButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = await getSupabaseServerClient();

  const { data: cases, error } = await supabase
    .from("cases")
    .select("id, created_at, company_name, industry, calc_total, calc_er, calc_ee, status, case_links(shareable_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = cases || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/80">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/favicon.png" alt="W2 Deck" width={24} height={24} />
            <span className="text-sm font-semibold" style={{ color: "#0b2043" }}>W2 Deck</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 hidden sm:inline">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0b2043" }}>Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              {rows.length} proposal{rows.length !== 1 ? "s" : ""} generated
            </p>
          </div>
          <Link
            href="/generate"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
            style={{ backgroundColor: "#0b2043" }}
          >
            <span className="text-lg leading-none">+</span>
            New Proposal
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <p className="text-sm text-red-700">Failed to load proposals. Please refresh.</p>
          </div>
        )}

        {/* Empty state */}
        {rows.length === 0 && !error && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(56,182,255,0.1)" }}>
              <svg className="w-8 h-8" style={{ color: "#38b6ff" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">No proposals yet</h2>
            <p className="text-sm text-gray-500 mb-6">Generate your first W-2 savings proposal.</p>
            <Link
              href="/generate"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
              style={{ backgroundColor: "#0b2043" }}
            >
              Generate Proposal
            </Link>
          </div>
        )}

        {/* Table */}
        {rows.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Industry</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">ER</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">EE</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString("en-US")}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {c.company_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                        {c.industry || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatUSD(c.calc_total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right hidden md:table-cell">
                        {formatUSD(c.calc_er)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right hidden md:table-cell">
                        {formatUSD(c.calc_ee)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          {c.status || "generated"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const links = c.case_links as { shareable_url: string | null }[] | null;
                          const url = links?.[0]?.shareable_url;
                          return url ? <CopyLinkButton url={url} /> : <span className="text-xs text-gray-300">—</span>;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
