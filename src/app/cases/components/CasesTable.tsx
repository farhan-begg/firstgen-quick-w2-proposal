"use client";

import { useState, useMemo, useCallback } from "react";
import { formatUSD } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaseRow {
  id: string;
  created_at: string;
  company_name: string;
  industry: string;
  calc_total: number;
  calc_er: number;
  calc_ee: number;
  status: string;
}

interface CasesTableProps {
  cases: CaseRow[];
  industries: string[];
  adminSecret: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CasesTable({
  cases,
  industries,
  adminSecret,
}: CasesTableProps) {
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [regenerateResult, setRegenerateResult] = useState<{
    caseId: string;
    url: string;
    passcode: string;
    expiresAt: string;
  } | null>(null);

  // Filter cases
  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const matchesSearch = !search || 
        (c.company_name || "").toLowerCase().includes(search.toLowerCase());
      const matchesIndustry = !industryFilter || c.industry === industryFilter;
      return matchesSearch && matchesIndustry;
    });
  }, [cases, search, industryFilter]);

  // Handle regenerate
  const handleRegenerate = useCallback(
    async (caseId: string) => {
      if (!confirm("Regenerate link for this case? The old link will be revoked.")) {
        return;
      }

      setRegenerating(caseId);
      setRegenerateResult(null);

      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/regenerate_link`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
              apikey: anonKey || "",
            },
            body: JSON.stringify({ case_id: caseId }),
          }
        );

        const json = await res.json();
        if (json.ok) {
          setRegenerateResult({
            caseId,
            url: json.url,
            passcode: json.passcode,
            expiresAt: json.expires_at,
          });
        } else {
          alert(`Regeneration failed: ${json.error || "Unknown error"}`);
        }
      } catch {
        alert("Failed to regenerate link. Please try again.");
      } finally {
        setRegenerating(null);
      }
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by company name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none text-sm"
        />
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none text-sm bg-white"
        >
          <option value="">All Industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
      </div>

      {/* Regenerate result banner */}
      {regenerateResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-800 mb-2">
            Link Regenerated Successfully
          </h3>
          <div className="text-sm text-green-700 space-y-1">
            <p>
              <span className="font-medium">URL:</span>{" "}
              <a
                href={regenerateResult.url}
                className="underline break-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                {regenerateResult.url}
              </a>
            </p>
            <p>
              <span className="font-medium">Passcode:</span>{" "}
              <code className="bg-green-100 px-2 py-0.5 rounded">
                {regenerateResult.passcode}
              </code>
            </p>
            <p>
              <span className="font-medium">Expires:</span>{" "}
              {new Date(regenerateResult.expiresAt).toLocaleDateString("en-US")}
            </p>
          </div>
          <button
            onClick={() => setRegenerateResult(null)}
            className="mt-2 text-xs text-green-600 hover:text-green-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Industry
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  ER
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  EE
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No cases found
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {c.company_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.industry || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatUSD(c.calc_total)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {formatUSD(c.calc_er)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {formatUSD(c.calc_ee)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRegenerate(c.id)}
                        disabled={regenerating === c.id}
                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 rounded-md font-medium transition-colors"
                      >
                        {regenerating === c.id
                          ? "Regenerating..."
                          : "Regenerate Link"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400">
        Showing {filtered.length} of {cases.length} case{cases.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    generated: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    pending: "bg-yellow-100 text-yellow-700",
  };
  const cls = colors[status] || "bg-gray-100 text-gray-700";

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || "unknown"}
    </span>
  );
}
