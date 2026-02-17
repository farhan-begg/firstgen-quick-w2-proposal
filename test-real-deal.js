require("dotenv").config({ path: ".env.local" });

async function test() {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  const baseUrl = process.env.PIPEDRIVE_BASE_URL;
  const fieldGenerate = process.env.PIPEDRIVE_FIELD_GENERATE_PROPOSAL;
  const optionYes = process.env.PIPEDRIVE_OPTION_GENERATE_YES;

  // Fetch the actual deal that was set to "Yes"
  console.log("--- Fetching deal 90724 to see actual field values ---");
  const res = await fetch(`${baseUrl}/deals/90724?api_token=${token}`);
  const json = await res.json();
  
  if (!json.success) {
    console.error("Failed:", json.error);
    return;
  }

  const deal = json.data;
  console.log("Deal title:", deal.title);
  console.log("Deal id:", deal.id);
  console.log(`\nField key: ${fieldGenerate}`);
  console.log(`Field value:`, JSON.stringify(deal[fieldGenerate]));
  console.log(`Type of value:`, typeof deal[fieldGenerate]);
  console.log(`Expected optionYes:`, optionYes);
  console.log(`String match:`, String(deal[fieldGenerate]) === String(optionYes));
  
  // Also check user_id format
  console.log(`\nuser_id field:`, JSON.stringify(deal.user_id));
  console.log(`user_id type:`, typeof deal.user_id);

  // Check what the webhook payload looks like by examining a few fields
  console.log("\n--- All custom field keys that have values ---");
  for (const [key, val] of Object.entries(deal)) {
    if (key.length > 30 && val !== null && val !== "") {
      console.log(`  ${key} = ${JSON.stringify(val)}`);
    }
  }

  console.log("\n--- Done ---");
}

test();
