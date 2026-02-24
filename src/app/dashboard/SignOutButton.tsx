"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
    >
      Sign Out
    </button>
  );
}
