require("dotenv").config({ path: ".env.local" });

async function test() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.PIPEDRIVE_WEBHOOK_SECRET;
  const fieldGenerate = process.env.PIPEDRIVE_FIELD_GENERATE_PROPOSAL;
  const fieldIndustry = process.env.PIPEDRIVE_FIELD_INDUSTRY;
  const fieldW2 = process.env.PIPEDRIVE_FIELD_W2_COUNT;
  const optionYes = process.env.PIPEDRIVE_OPTION_GENERATE_YES;

  const url = `${supabaseUrl}/functions/v1/generate_case_from_pipedrive?secret=${secret}`;
  
  console.log("--- Testing webhook endpoint ---");
  console.log("URL:", url.slice(0, 80) + "...");
  console.log("Field key for generate_proposal:", fieldGenerate);
  console.log("Option YES ID:", optionYes);

  // Simulate a Pipedrive webhook payload where generate_proposal changes to Yes
  const payload = {
    current: {
      id: 90724,
      title: "KULJOT LLC / DBA SHORT STOP MARKET",
      [fieldGenerate]: optionYes,
      [fieldIndustry]: "Liquor Stores",
      [fieldW2]: 20,
      user_id: { id: 23901493, name: "Farhan Begg", email: "farhan@1gfg.com" },
    },
    previous: {
      id: 90724,
      title: "KULJOT LLC / DBA SHORT STOP MARKET",
      [fieldGenerate]: "", // Was empty, now changed to Yes
      [fieldIndustry]: "Liquor Stores",
      [fieldW2]: 20,
    },
    event: "updated.deal",
  };

  console.log("\nPayload current[generateField]:", payload.current[fieldGenerate]);
  console.log("Payload previous[generateField]:", payload.previous[fieldGenerate]);
  console.log("Expected optionYes:", optionYes);
  console.log("Match?", String(payload.current[fieldGenerate]) === String(optionYes));

  console.log("\n--- Sending test webhook ---");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    try {
      const json = JSON.parse(text);
      console.log("Response:", JSON.stringify(json, null, 2));
    } catch {
      console.log("Response (raw):", text);
    }
  } catch (e) {
    console.error("Request failed:", e.message);
  }

  console.log("\n--- Done ---");
}

test();
