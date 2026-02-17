"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { formatUSD } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewState =
  | "idle"
  | "submitting"
  | "success"
  | "invalid"
  | "expired"
  | "revoked"
  | "locked"
  | "wrong_passcode"
  | "error";

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
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setValue(current);
      if (progress < 1) {
        start = requestAnimationFrame(step);
      }
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
  const [caseId, setCaseId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [state, setState] = useState<ViewState>("idle");
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resolve params and searchParams (they are Promises in Next.js 15+)
  useEffect(() => {
    Promise.all([params, searchParams]).then(([p, sp]) => {
      setCaseId(p.id);
      setToken(sp.t || "");
    });
  }, [params, searchParams]);

  // ---------------------------------------------------------------------------
  // Passcode input handling
  // ---------------------------------------------------------------------------

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;
      const newDigits = [...digits];
      newDigits[index] = value.slice(-1);
      setDigits(newDigits);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted.length === 0) return;
    const newDigits = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const passcode = digits.join("");
      if (passcode.length !== 6) return;

      setState("submitting");
      setErrorMessage("");

      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/validate_case_access`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
              apikey: anonKey || "",
            },
            body: JSON.stringify({ case_id: caseId, token, passcode }),
          }
        );

        const json = await res.json();

        if (json.ok && json.state === "success") {
          setState("success");
          setCaseData(json.data);
        } else {
          setState(json.state || "error");
          if (json.state === "wrong_passcode") {
            setShake(true);
            setTimeout(() => setShake(false), 500);
          }
          if (json.remaining_attempts !== undefined) {
            setRemainingAttempts(json.remaining_attempts);
          }
        }
      } catch {
        setState("error");
        setErrorMessage("Unable to verify. Please try again.");
      }
    },
    [caseId, token, digits]
  );

  const handleRetry = useCallback(() => {
    setDigits(Array(6).fill(""));
    setState("idle");
    setRemainingAttempts(null);
    inputRefs.current[0]?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Animated counters for success view
  // ---------------------------------------------------------------------------

  const isSuccess = state === "success" && caseData;
  const animTotal = useCountUp(caseData?.calc_total ?? 0, 1400, !!isSuccess);
  const animEr = useCountUp(caseData?.calc_er ?? 0, 1200, !!isSuccess);
  const animEe = useCountUp(caseData?.calc_ee ?? 0, 1200, !!isSuccess);

  // ---------------------------------------------------------------------------
  // Guard: missing token
  // ---------------------------------------------------------------------------

  if (!caseId) {
    return (
      <PageShell>
        <LoadingSpinner />
      </PageShell>
    );
  }

  if (!token) {
    return (
      <PageShell>
        <div className="animate-scale-in">
          <StatusCard
            title="Invalid Link"
            message="This link is missing required parameters. Please check the link you received."
            variant="error"
          />
        </div>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Success view
  // ---------------------------------------------------------------------------

  if (isSuccess && caseData) {
    return (
      <PageShell companyName={caseData.company_name}>
        <div className="w-full max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
            {/* Header */}
            <div
              className="px-8 py-8 animate-fade-in"
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
                W-2 Tax Savings Proposal
              </p>
              <h1
                className="text-2xl font-bold text-white animate-fade-in-up"
                style={{ animationDelay: "200ms" }}
              >
                {caseData.company_name}
              </h1>
              <div
                className="flex items-center gap-3 mt-3 animate-fade-in-up"
                style={{ animationDelay: "300ms" }}
              >
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                  style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,0.2)" }}
                >
                  {caseData.industry}
                </span>
                <span style={{ color: "rgba(255,255,255,0.7)" }} className="text-xs">
                  {caseData.calc_inputs.w2_count} W-2 Employees &middot; Tax
                  Year {caseData.calc_inputs.tax_year}
                </span>
              </div>
            </div>

            {/* Hero Number */}
            <div
              className="px-8 py-10 text-center border-b border-gray-100"
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
              <p
                className="text-sm text-gray-400 mt-3 animate-fade-in"
                style={{ animationDelay: "800ms" }}
              >
                {formatUSD(caseData.calc_inputs.rate_total)} per W-2 &times;{" "}
                {caseData.calc_inputs.w2_count} employees
              </p>
            </div>

            {/* Breakdown */}
            <div className="px-8 py-8">
              <h3
                className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5 animate-fade-in"
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
                  <p className="text-xs text-emerald-500 mt-2">
                    {formatUSD(caseData.calc_inputs.rate_er)} per W-2
                  </p>
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
                  <p className="text-xs text-sky-500 mt-2">
                    {formatUSD(caseData.calc_inputs.rate_ee)} per W-2
                  </p>
                </div>
              </div>
            </div>

            {/* Calculation Details */}
            <div
              className="px-8 pb-6 animate-fade-in-up"
              style={{ animationDelay: "1100ms" }}
            >
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Calculation Details
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                  {caseData.calc_explanation}
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <div
              className="px-8 pb-8 animate-fade-in"
              style={{ animationDelay: "1300ms" }}
            >
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

  // ---------------------------------------------------------------------------
  // Passcode / error states
  // ---------------------------------------------------------------------------

  return (
    <PageShell>
      <div className="w-full max-w-md mx-auto">
        {/* Error states */}
        {state === "invalid" && (
          <div className="animate-scale-in">
            <StatusCard
              title="Invalid Link"
              message="This link is not valid. It may have been revoked or does not exist."
              variant="error"
            />
          </div>
        )}

        {state === "expired" && (
          <div className="animate-scale-in">
            <StatusCard
              title="Link Expired"
              message="This link has expired. Please request a new one from your contact."
              variant="warning"
            />
          </div>
        )}

        {state === "revoked" && (
          <div className="animate-scale-in">
            <StatusCard
              title="Link Revoked"
              message="This link has been revoked. A new link may have been issued — please check with your contact."
              variant="warning"
            />
          </div>
        )}

        {state === "locked" && (
          <div className="animate-scale-in">
            <StatusCard
              title="Too Many Attempts"
              message="This link has been temporarily locked due to too many incorrect attempts. Please try again in 30 minutes."
              variant="error"
            />
          </div>
        )}

        {state === "error" && (
          <div className="animate-scale-in">
            <StatusCard
              title="Something Went Wrong"
              message={
                errorMessage ||
                "An unexpected error occurred. Please try again."
              }
              variant="error"
            />
          </div>
        )}

        {/* Passcode form */}
        {(state === "idle" ||
          state === "wrong_passcode" ||
          state === "submitting") && (
          <div className="animate-scale-in">
            <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
              <div className="px-6 py-6 flex justify-center" style={{ background: "linear-gradient(135deg, #0b2043 0%, #0b2043 50%, #1a3a6b 100%)" }}>
                <Image
                  src="/logo-full-white.png"
                  alt="First Gen Industries"
                  width={160}
                  height={36}
                  className="animate-fade-in-down"
                  priority
                />
              </div>
              <div className="p-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-soft" style={{ backgroundColor: "#eef8ff" }}>
                    <svg
                      className="w-7 h-7"
                      style={{ color: "#38b6ff" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    Enter Passcode
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Enter the 6-digit passcode you were given
                  </p>
                </div>

                {state === "wrong_passcode" && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center animate-fade-in">
                    <p className="text-sm text-red-700 font-medium">
                      Incorrect passcode
                    </p>
                    {remainingAttempts !== null && (
                      <p className="text-xs text-red-500 mt-1">
                        {remainingAttempts} attempt
                        {remainingAttempts !== 1 ? "s" : ""} remaining
                      </p>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div
                    className={`flex justify-center gap-2.5 mb-6 transition-transform ${
                      shake ? "animate-[shake_0.4s_ease-in-out]" : ""
                    }`}
                    onPaste={handlePaste}
                    style={
                      shake
                        ? {
                            animation:
                              "shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
                          }
                        : undefined
                    }
                  >
                    {digits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          inputRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        className={`w-12 h-14 text-center text-xl font-semibold border-2 rounded-lg outline-none
                          transition-all duration-200 ease-out
                          ${
                            digit
                              ? "scale-105"
                              : "border-gray-200 bg-white"
                          }
                          focus:scale-110
                          disabled:opacity-50`}
                        style={{
                          animationDelay: `${i * 50}ms`,
                          ...(digit ? { borderColor: "#38b6ff", backgroundColor: "rgba(56,182,255,0.08)" } : {}),
                        }}
                        disabled={state === "submitting"}
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={
                      digits.join("").length !== 6 || state === "submitting"
                    }
                    className="w-full py-3.5 px-4 active:scale-[0.98]
                      disabled:bg-gray-300 disabled:cursor-not-allowed disabled:active:scale-100
                      text-white font-medium rounded-xl transition-all duration-200 ease-out"
                    style={
                      digits.join("").length !== 6 || state === "submitting"
                        ? undefined
                        : { backgroundColor: "#0b2043", boxShadow: "0 10px 15px -3px rgba(11,32,67,0.2)" }
                    }
                  >
                    {state === "submitting" ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
                          viewBox="0 0 24 24"
                        >
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
                        Verifying...
                      </span>
                    ) : (
                      "Verify"
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Retry for non-locked error states */}
        {(state === "error" || state === "invalid") && (
          <div className="text-center mt-4 animate-fade-in" style={{ animationDelay: "300ms" }}>
            <button
              onClick={handleRetry}
              className="text-sm underline transition-colors"
              style={{ color: "#38b6ff" }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/80 flex flex-col items-center justify-center p-4">
      <div className="flex-1 flex items-center justify-center w-full py-8">
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
