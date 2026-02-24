"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function GeneratePage() {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [w2Count, setW2Count] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    url: string;
    case_id: string;
    expires_at: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);

    const count = parseInt(w2Count, 10);
    if (!companyName.trim()) { setError("Business name is required."); return; }
    if (!industry.trim()) { setError("Industry is required."); return; }
    if (!w2Count || isNaN(count) || count <= 0) { setError("W-2 count must be a positive number."); return; }
    if (count > 100000) { setError("W-2 count seems too high. Please verify."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          industry: industry.trim(),
          w2_count: count,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Failed to generate proposal.");
        return;
      }

      setResult({
        url: json.url,
        case_id: json.case_id,
        expires_at: json.expires_at,
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = result.url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/80">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/favicon.png" alt="W2 Deck" width={24} height={24} />
            <span className="text-sm font-semibold" style={{ color: "#0b2043" }}>W2 Deck</span>
          </Link>
          <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
            &larr; Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "#0b2043" }}>New Proposal</h1>
          <p className="text-sm text-gray-500 mt-1">Enter the details below to generate a shareable W-2 savings proposal.</p>
        </div>

        {/* Success state */}
        {result && (
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-6 mb-6 animate-scale-in">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-600 text-lg">&#10003;</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Proposal Generated</h2>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 mb-4">
              <p className="text-xs text-gray-400 mb-1">Shareable Link</p>
              <p className="text-sm text-gray-800 break-all font-mono">{result.url}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 px-4 text-white font-medium rounded-xl text-sm transition-all active:scale-[0.98]"
                style={{ backgroundColor: copied ? "#10b981" : "#0b2043" }}
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={() => window.open(result.url, "_blank")}
                className="py-2.5 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl text-sm hover:bg-gray-200 transition-all"
              >
                Preview
              </button>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Expires {new Date(result.expires_at).toLocaleDateString("en-US")}
              </p>
              <button
                onClick={() => {
                  setResult(null);
                  setCompanyName("");
                  setIndustry("");
                  setW2Count("");
                }}
                className="text-xs font-medium transition-colors"
                style={{ color: "#38b6ff" }}
              >
                Generate Another
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        {!result && (
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-6 animate-fade-in">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name
                </label>
                <input
                  id="company"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:border-[#38b6ff] focus:ring-2 focus:ring-[#38b6ff]/20"
                  placeholder="e.g. Acme Corp"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <input
                  id="industry"
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:border-[#38b6ff] focus:ring-2 focus:ring-[#38b6ff]/20"
                  placeholder="e.g. Manufacturing"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="w2count" className="block text-sm font-medium text-gray-700 mb-1">
                  Number of W-2 Employees
                </label>
                <input
                  id="w2count"
                  type="number"
                  min="1"
                  step="1"
                  value={w2Count}
                  onChange={(e) => setW2Count(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:border-[#38b6ff] focus:ring-2 focus:ring-[#38b6ff]/20"
                  placeholder="e.g. 25"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#0b2043" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  "Generate Proposal"
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
