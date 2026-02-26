"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { formatUSD } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewState = "loading" | "success" | "invalid" | "expired" | "revoked" | "error";

interface CaseData {
  company_name: string;
  industry: string;
  calc_total: number;
  calc_er: number;
  calc_ee: number;
  calc_inputs: {
    w2_count: number;
    tax_year: number;
    rate_total: number;
    rate_er: number;
    rate_ee: number;
  };
  calc_explanation: string;
}

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let start = 0;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) start = requestAnimationFrame(step);
    };
    start = requestAnimationFrame(step);
    return () => cancelAnimationFrame(start);
  }, [target, duration, enabled]);
  return value;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CaseViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [state, setState] = useState<ViewState>("loading");
  const [caseData, setCaseData] = useState<CaseData | null>(null);

  // Auto-validate on mount
  useEffect(() => {
    let cancelled = false;

    async function validate() {
      const [p, sp] = await Promise.all([params, searchParams]);
      const caseId = p.id;
      const token = sp.t;

      if (!caseId || !token) {
        if (!cancelled) setState("invalid");
        return;
      }

      try {
        const res = await fetch("/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ case_id: caseId, token }),
        });

        const json = await res.json();
        if (cancelled) return;

        if (json.ok && json.state === "success") {
          setCaseData(json.data);
          setState("success");
        } else {
          setState(json.state || "error");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    validate();
    return () => { cancelled = true; };
  }, [params, searchParams]);

  // Animated counters
  const isSuccess = state === "success" && caseData;
  const animTotal = useCountUp(caseData?.calc_total ?? 0, 1400, !!isSuccess);
  const animEr = useCountUp(caseData?.calc_er ?? 0, 1200, !!isSuccess);
  const animEe = useCountUp(caseData?.calc_ee ?? 0, 1200, !!isSuccess);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (state === "loading") {
    return <PageShell><LoadingSpinner /></PageShell>;
  }

  // ---------------------------------------------------------------------------
  // Error states
  // ---------------------------------------------------------------------------

  if (state === "invalid" || state === "error") {
    return (
      <PageShell>
        <div className="animate-scale-in">
          <StatusCard title="Invalid Link" message="This link is not valid or does not exist. Please check the link you received." variant="error" />
        </div>
      </PageShell>
    );
  }

  if (state === "expired") {
    return (
      <PageShell>
        <div className="animate-scale-in">
          <StatusCard title="Link Expired" message="This proposal link has expired. Please request a new one from your contact." variant="warning" />
        </div>
      </PageShell>
    );
  }

  if (state === "revoked") {
    return (
      <PageShell>
        <div className="animate-scale-in">
          <StatusCard title="Link Revoked" message="This link has been revoked. A new link may have been issued — please check with your contact." variant="warning" />
        </div>
      </PageShell>
    );
  }

  if (!caseData) {
    return <PageShell><LoadingSpinner /></PageShell>;
  }

  // ---------------------------------------------------------------------------
  // Success view
  // ---------------------------------------------------------------------------

  if (isSuccess && caseData) {
    const w2 = caseData.calc_inputs.w2_count;
    const year = caseData.calc_inputs.tax_year;

    return (
      <PageShell companyName={caseData.company_name}>
        <div className="w-full max-w-2xl mx-auto space-y-5 sm:space-y-6">

          {/* ============================================================ */}
          {/* CARD 1 — Header + Hero Numbers                               */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
            {/* Header */}
            <div
              className="px-5 py-7 sm:px-8 sm:py-8 animate-fade-in"
              style={{ background: "linear-gradient(135deg, #0b2043 0%, #38b6ff 60%, #38b6ff 100%)" }}
            >
              <Image
                src="/logo-white.png"
                alt="First Gen Industries"
                width={180}
                height={40}
                className="mb-6 animate-fade-in-down"
                priority
              />
              <p
                className="text-xs font-medium uppercase tracking-widest mb-1 animate-fade-in-up"
                style={{ animationDelay: "100ms", color: "rgba(255,255,255,0.7)" }}
              >
                SIMERP — W-2 Tax Savings Proposal
              </p>
              <h1
                className="text-2xl font-bold text-white animate-fade-in-up"
                style={{ animationDelay: "200ms" }}
              >
                {caseData.company_name}
              </h1>
              <div
                className="flex flex-wrap items-center gap-3 mt-3 animate-fade-in-up"
                style={{ animationDelay: "300ms" }}
              >
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                  style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,0.2)" }}
                >
                  {caseData.industry}
                </span>
                <span style={{ color: "rgba(255,255,255,0.7)" }} className="text-xs">
                  {w2} W-2 Employees &middot; Tax Year {year}
                </span>
              </div>
            </div>

            {/* Hero Number */}
            <div
              className="px-5 py-8 sm:px-8 sm:py-10 text-center border-b border-gray-100"
              style={{ background: "linear-gradient(to bottom, #eef8ff, #ffffff)" }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3 animate-fade-in"
                style={{ animationDelay: "400ms", color: "#0b2043" }}
              >
                Estimated Total Tax Reduction
              </p>
              <p
                className="text-5xl sm:text-6xl font-extrabold text-gray-900 tracking-tight animate-number-pop"
                style={{ animationDelay: "500ms" }}
              >
                {formatUSD(animTotal)}
              </p>
              {/* rate subtitle removed */}
            </div>

            {/* Breakdown Cards */}
            <div className="px-5 py-7 sm:px-8 sm:py-8">
              <h3
                className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 sm:mb-5 animate-fade-in"
                style={{ animationDelay: "700ms" }}
              >
                Savings Breakdown
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 animate-slide-up hover:shadow-md hover:shadow-emerald-100/50 transition-shadow duration-300"
                  style={{ animationDelay: "800ms" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                      Employer Net Savings
                    </p>
                  </div>
                  <p className="text-3xl sm:text-4xl font-bold text-emerald-700 mt-1">
                    {formatUSD(animEr)}
                  </p>
                  {/* rate subtitle removed */}
                </div>
                <div
                  className="bg-sky-50 border border-sky-100 rounded-xl p-6 animate-slide-up hover:shadow-md hover:shadow-sky-100/50 transition-shadow duration-300"
                  style={{ animationDelay: "950ms" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse-soft" />
                    <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
                      Employee Reduction
                    </p>
                  </div>
                  <p className="text-3xl sm:text-4xl font-bold text-sky-700 mt-1">
                    {formatUSD(animEe)}
                  </p>
                  {/* rate subtitle removed */}
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* TRUST BAR — Social Proof                                     */}
          {/* ============================================================ */}
          <div className="animate-fade-in-up" style={{ animationDelay: "1000ms" }}>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { value: "10,000+", label: "Employers Served" },
                { value: "50", label: "States Covered" },
                { value: "1M+", label: "Members Enrolled" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl py-4 px-3 sm:py-5 sm:px-4 text-center border"
                  style={{ backgroundColor: "rgba(11,32,67,0.03)", borderColor: "rgba(11,32,67,0.08)" }}
                >
                  <p className="text-xl sm:text-3xl font-extrabold" style={{ color: "#0b2043" }}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ============================================================ */}
          {/* CARD 2 — What is SIMERP?                                     */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: "1100ms" }}>
            <div className="px-5 pt-7 pb-2 sm:px-8 sm:pt-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#38b6ff" }}>
                Overview
              </p>
              <h2 className="text-lg font-bold text-gray-900" style={{ color: "#0b2043" }}>
                What is SIMERP?
              </h2>
              <p className="text-xs text-gray-400 mt-1">A proven program that saves employers money while giving employees better benefits.</p>
              <p className="text-sm text-gray-600 mt-4 leading-relaxed">
                A <span className="font-semibold">Self Insured Medical Expense Reimbursement Plan (SIMERP)</span> is
                an employer-sponsored workplace program that allows employees to supplement their
                benefits with zero net out-of-pocket costs. SIMERP reduces business payroll costs
                by up to <span className="font-semibold">$1,186 per W-2 employee</span>, and results in an increase
                to the bottom line of the organization.
              </p>
              <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                The program is derived from the IRC &amp; Affordable Care Act, established during the
                ACA era. It is centered around the government&apos;s focus on establishing a healthier,
                more productive workforce.
              </p>
            </div>

            {/* Employer & Employee Benefits */}
            <div className="px-5 py-6 sm:px-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Employer */}
                <div className="rounded-xl p-5 border" style={{ backgroundColor: "rgba(16,185,129,0.04)", borderColor: "rgba(16,185,129,0.15)" }}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#0b2043" }}>
                    Benefit to the Employer
                  </h3>
                  <ul className="space-y-2.5 text-sm text-gray-600">
                    <li className="flex gap-2">
                      <span className="text-emerald-500 mt-0.5 shrink-0">&#10003;</span>
                      <span>No out-of-pocket cost + average <strong>$1,186</strong> in net EBITDA increase per employee per year</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-500 mt-0.5 shrink-0">&#10003;</span>
                      <span>Increase in business profitability &amp; valuation by directly decreasing payroll expenses</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-500 mt-0.5 shrink-0">&#10003;</span>
                      <span>Increased employee satisfaction &amp; retention</span>
                    </li>
                  </ul>
                </div>
                {/* Employee */}
                <div className="rounded-xl p-5 border" style={{ backgroundColor: "rgba(56,182,255,0.04)", borderColor: "rgba(56,182,255,0.15)" }}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#0b2043" }}>
                    Benefit to the Employee
                  </h3>
                  <ul className="space-y-2.5 text-sm text-gray-600">
                    <li className="flex gap-2">
                      <span style={{ color: "#38b6ff" }} className="mt-0.5 shrink-0">&#10003;</span>
                      <span>Increased benefits at <strong>$0 out-of-pocket cost</strong> — health insurance, life insurance &amp; more, extending to family</span>
                    </li>
                    <li className="flex gap-2">
                      <span style={{ color: "#38b6ff" }} className="mt-0.5 shrink-0">&#10003;</span>
                      <span>Increase in take-home pay</span>
                    </li>
                    <li className="flex gap-2">
                      <span style={{ color: "#38b6ff" }} className="mt-0.5 shrink-0">&#10003;</span>
                      <span>Increased satisfaction with employer and benefits plan</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* CARD 3 — Employee Benefits Detail                            */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: "1200ms" }}>
            <div className="px-5 pt-7 pb-2 sm:px-8 sm:pt-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#38b6ff" }}>
                What Your Team Gets
              </p>
              <h2 className="text-lg font-bold" style={{ color: "#0b2043" }}>
                Employee Benefits
              </h2>
              <p className="text-xs text-gray-400 mt-1">Healthcare, telehealth, and life insurance — all at $0 out-of-pocket cost.</p>
            </div>

            <div className="px-5 py-6 sm:px-8 space-y-7 sm:space-y-6">
              {/* MEC Services */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#38b6ff" }}>
                  MEC Services (In-Person)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { title: "$0 Copay Primary Care", desc: "Preventive visits with your primary care physician" },
                    { title: "$0 Copay Generic Rx", desc: "2,900 common generic prescriptions covered at $0" },
                    { title: "$0 Copay Hospital Bill Advocacy", desc: "Technology & financial assistance to reduce or erase hospital bills" },
                  ].map((item) => (
                    <div key={item.title} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Telehealth */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#38b6ff" }}>
                  Telehealth Services (Covers up to 6 Dependents)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    "$0 Copay Unlimited Virtual Urgent Care Visits",
                    "$0 Copay Unlimited Virtual Primary Care Visits",
                    "$0 Copay Unlimited Virtual Counseling Sessions",
                    "$0 Copay 1 Comprehensive Lab Per Year",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <span style={{ color: "#38b6ff" }} className="text-sm mt-0.5 shrink-0">&#10003;</span>
                      <p className="text-sm text-gray-700">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Life Insurance */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#38b6ff" }}>
                  + Additional Voluntary Benefits
                </h3>
                <div className="rounded-xl p-5 border border-gray-100" style={{ backgroundColor: "rgba(56,182,255,0.03)" }}>
                  <p className="text-sm font-semibold text-gray-800 mb-3">
                    Up to $250,000 Whole Life Insurance Policy
                  </p>
                  <div className="space-y-3 sm:space-y-2">
                    {[
                      { num: "1", text: "Traditional whole life insurance — beneficiaries receive death benefit as a lump-sum cash payment." },
                      { num: "2", text: "Long-term care services — draw funds from death benefit for monthly long-term care payments." },
                      { num: "3", text: "Accumulated cash value — withdraw funds or borrow against cash balance for financial emergencies." },
                    ].map((item) => (
                      <div key={item.num} className="flex gap-3">
                        <span className="w-6 h-6 rounded-full text-xs font-bold text-white flex items-center justify-center shrink-0" style={{ backgroundColor: "#0b2043" }}>
                          {item.num}
                        </span>
                        <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* CARD 4 — Employer Payroll Savings Detail                     */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: "1300ms" }}>
            <div className="px-5 pt-7 sm:px-8 sm:pt-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#38b6ff" }}>
                Your Bottom Line
              </p>
              <h2 className="text-lg font-bold" style={{ color: "#0b2043" }}>
                Employer Benefit
              </h2>
              <p className="text-xs text-gray-400 mt-1">How SIMERP directly reduces payroll costs and increases profitability.</p>
            </div>

            <div className="px-5 py-6 sm:px-8 space-y-5 sm:space-y-6">
              {/* Payroll Savings */}
              <div className="rounded-xl p-6 border" style={{ backgroundColor: "rgba(16,185,129,0.04)", borderColor: "rgba(16,185,129,0.15)" }}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="text-center sm:text-left shrink-0">
                    <p className="text-3xl font-extrabold" style={{ color: "#0b2043" }}>$1,186<span className="text-base font-medium text-gray-400">/yr</span></p>
                    <p className="text-xs text-gray-500 mt-1">Avg. Employer Tax Savings<br />Per Employee, Per Year</p>
                  </div>
                  <div className="sm:border-l sm:border-gray-200 sm:pl-4">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      The net savings stem from contributing less to FICA taxes due to the taxable
                      income of employees being a lesser amount. Your FICA rate of 7.65% remains the same,
                      but on a lowered taxable income, creating a delta in tax savings.
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed mt-2">
                      The savings also directly increase your <strong>EBITDA &amp; enterprise valuation</strong> by
                      decreasing operating expenses. Made possible through the Affordable Care Act,
                      Section 125, Section 213(d) &amp; Section 105 of the Internal Revenue Code.
                    </p>
                  </div>
                </div>
              </div>

              {/* Turnover + Current Benefits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Reduce Employee Turnover</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    With rising healthcare costs, it&apos;s often not financially feasible for employers to offer
                    benefits. This program is a great solution to reduce turnover, increase retention,
                    &amp; provide benefits at zero net out-of-pocket cost.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Does This Impact Current Benefits?</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    This does not conflict with any current benefits in place &amp; does not affect or
                    replace anything — it simply stacks on top. Implementation is simple, our team
                    does all the heavy lifting. Live within 60 days.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* CARD 5 — Paycheck Example                                    */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: "1400ms" }}>
            <div className="px-5 pt-7 pb-2 sm:px-8 sm:pt-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#38b6ff" }}>
                See It In Action
              </p>
              <h2 className="text-lg font-bold" style={{ color: "#0b2043" }}>
                Paycheck Example
              </h2>
              <p className="text-xs text-gray-400 mt-1">Illustrative monthly example showing how take-home pay increases.</p>
            </div>

            <div className="px-3 py-6 sm:px-8">
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "#0b2043" }}>
                      <th className="text-left px-3 py-3 sm:px-4 text-[10px] sm:text-xs font-semibold text-white uppercase tracking-wider">Item</th>
                      <th className="text-right px-2 py-3 sm:px-4 text-[10px] sm:text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Without</th>
                      <th className="text-right px-2 py-3 sm:px-4 text-[10px] sm:text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#38b6ff" }}>With SIMERP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { label: "Monthly Gross Pay", without: "$3,293.33", with: "$3,293.33" },
                      { label: "SIMERP: Pre-Tax Deduction", without: "$0.00", with: "-$1,293.00", highlight: true },
                      { label: "Taxable Income", without: "$3,293.33", with: "$2,000.33" },
                      { label: "Federal Withholding", without: "-$395.20", with: "-$240.04" },
                      { label: "State Withholding", without: "-$189.36", with: "-$116.23" },
                      { label: "Social Security", without: "-$204.18", with: "-$124.02" },
                      { label: "Medicare", without: "-$47.75", with: "-$29.00" },
                      { label: "Total Taxes", without: "-$836.49", with: "-$509.29", bold: true },
                      { label: "SIMERP: Reimbursement", without: "$0.00", with: "+$1,293.00", highlight: true },
                      { label: "After-Tax Deduction", without: "$0.00", with: "-$258.14" },
                    ].map((row) => (
                      <tr key={row.label} className={row.highlight ? "bg-blue-50/50" : row.bold ? "bg-gray-50" : ""}>
                        <td className={`px-3 py-2.5 sm:px-4 text-gray-700 ${row.bold || row.highlight ? "font-semibold" : ""}`}>{row.label}</td>
                        <td className={`px-2 py-2.5 sm:px-4 text-right text-gray-500 whitespace-nowrap ${row.bold ? "font-semibold" : ""}`}>{row.without}</td>
                        <td className={`px-2 py-2.5 sm:px-4 text-right whitespace-nowrap ${row.highlight ? "font-semibold" : ""} ${row.bold ? "font-semibold text-gray-900" : ""}`}
                          style={row.highlight ? { color: "#38b6ff" } : undefined}
                        >{row.with}</td>
                      </tr>
                    ))}
                    {/* Net Take Home - special row */}
                    <tr style={{ backgroundColor: "#0b2043" }}>
                      <td className="px-3 py-3 sm:px-4 font-bold text-white">NET TAKE HOME PAY</td>
                      <td className="px-2 py-3 sm:px-4 text-right font-bold text-gray-300 whitespace-nowrap">$2,456.84</td>
                      <td className="px-2 py-3 sm:px-4 text-right font-bold whitespace-nowrap" style={{ color: "#38b6ff" }}>$2,525.90</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Net impact summary */}
              <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 sm:p-4 text-center border border-emerald-100">
                  <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Gross Tax Savings</p>
                  <p className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5">+$327.20</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-100">
                  <p className="text-[10px] sm:text-xs text-gray-500 font-medium">Supplemental Benefits</p>
                  <p className="text-base sm:text-lg font-bold text-gray-700 mt-0.5">-$258.14</p>
                </div>
                <div className="rounded-lg p-3 sm:p-4 text-center border" style={{ backgroundColor: "rgba(56,182,255,0.08)", borderColor: "rgba(56,182,255,0.2)" }}>
                  <p className="text-[10px] sm:text-xs font-medium" style={{ color: "#0b2043" }}>Net Pay Increase</p>
                  <p className="text-base sm:text-lg font-bold mt-0.5" style={{ color: "#38b6ff" }}>+$69.06</p>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* CARD 6 — Compliance                                          */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: "1500ms" }}>
            <div className="px-5 pt-7 pb-2 sm:px-8 sm:pt-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#38b6ff" }}>
                Legal Foundation
              </p>
              <h2 className="text-lg font-bold" style={{ color: "#0b2043" }}>
                Compliance &amp; Tax Codes
              </h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                The Plan is a Self-Insured Medical Reimbursement Plan (SIMERP) purposely created,
                thoroughly researched, and found compliant with IRC 213(d), 106(a), 105(b), 1.105-II(i),
                and 104(a)(3) codes, and all applicable IRS memos, ERISA regulations, HIPAA, and the ADA.
              </p>
            </div>

            <div className="px-5 py-6 sm:px-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { label: "Wellness", codes: "IRC §106(a), §213(d), §105(b), ERISA, HIPAA, ADA" },
                  { label: "Medical", codes: "IRC §213(d), ACA" },
                  { label: "Pre-Tax", codes: "IRC §106(a), §213(d), §125" },
                  { label: "Post-Tax", codes: "IRC §105(b), §213(d), 1.105-11(i), 104(a)(3)" },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#0b2043" }}>{item.label}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.codes}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* CARD 7 — Calculation Details + Disclaimer                    */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: "1600ms" }}>
            {/* Calculation Details */}
            <div className="px-5 pt-7 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
              <div className="bg-gray-50 rounded-xl p-4 sm:p-5 border border-gray-100">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Calculation Details
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                  {caseData.calc_explanation}
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="px-5 pb-7 sm:px-8 sm:pb-8">
              <div className="border-t border-gray-100 pt-5">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Disclaimer
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  All figures are estimates only. In particular, the EBITDA
                  multiple and resulting valuation increase are illustrative and
                  can change materially based on market conditions and
                  transaction specifics. This is not financial, tax, or legal
                  advice. Consult your advisors.
                </p>
              </div>
            </div>
          </div>

        </div>
      </PageShell>
    );
  }

}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PageShell({
  children,
  companyName,
}: {
  children: React.ReactNode;
  companyName?: string;
}) {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/80 flex flex-col items-center justify-center px-3 py-4 sm:p-4">
      <div className="flex-1 flex items-center justify-center w-full py-6 sm:py-8">
        {children}
      </div>
      <footer
        className="w-full max-w-2xl mx-auto pt-8 pb-6 animate-fade-in"
        style={{ animationDelay: "1500ms" }}
      >
        <div className="border-t border-gray-200 pt-6">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-6 text-xs text-gray-400">
            {/* Left — Company info */}
            <div className="space-y-1">
              <p className="font-semibold text-gray-500">First Gen Financial</p>
              <p>
                <a
                  href="mailto:Operations@1gfg.com"
                  className="transition-colors hover:[color:#38b6ff]"
                >
                  Operations@1gfg.com
                </a>
              </p>
              <p>99 Wall Street #5012</p>
              <p>New York, NY 10005</p>
            </div>

            {/* Right — Legal */}
            <div className="sm:text-right space-y-1">
              {companyName && (
                <p className="text-gray-500">
                  Report generated for:{" "}
                  <span className="font-medium">{companyName}</span>
                </p>
              )}
              <p>
                Copyright &copy; {year}, First Gen Industries LTD. All Rights
                Reserved.
              </p>
              <p>&copy; {year} First Gen Financial</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 animate-fade-in">
      <Image
        src="/logo-white.png"
        alt="First Gen Industries"
        width={140}
        height={32}
        className="opacity-20 animate-shimmer"
      />
      <svg className="animate-spin h-6 w-6" style={{ color: "#38b6ff" }} viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

function StatusCard({
  title,
  message,
  variant,
}: {
  title: string;
  message: string;
  variant: "error" | "warning";
}) {
  const colors =
    variant === "error"
      ? "bg-red-50 border-red-200 text-red-800"
      : "bg-amber-50 border-amber-200 text-amber-800";

  return (
    <div className={`rounded-2xl border p-8 text-center ${colors}`}>
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
          variant === "error" ? "bg-red-100" : "bg-amber-100"
        }`}
      >
        <svg
          className={`w-7 h-7 ${variant === "error" ? "text-red-500" : "text-amber-500"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm opacity-80 leading-relaxed">{message}</p>
    </div>
  );
}
