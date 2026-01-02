const { startFixtureServer } = require("../fixture-server");
const { executeReality } = require("../../src/guardian/reality");
const fs = require("fs");
const path = require("path");

async function run() {
  const fixture = await startFixtureServer();
  console.log("SERVER:", fixture.baseUrl);
  
  // Run 1: landing-only
  const r1 = await executeReality({
    baseUrl: `${fixture.baseUrl}/landing-only`,
    artifactsDir: ".odavlguardian/e2e-landing",
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: true,
    maxPages: 5,
    maxDepth: 2
  });
  const d1 = JSON.parse(fs.readFileSync(".odavlguardian/e2e-landing/decision.json"));
  const s1 = fs.readFileSync(".odavlguardian/e2e-landing/summary.txt", "utf8");
  console.log("\n=== RUN 1: /landing-only ===");
  console.log("Verdict:", d1.finalVerdict, "Exit:", r1.exitCode);
  console.log("ObservedCaps:", JSON.stringify(d1.observedCapabilities));
  console.log("Applicability:", JSON.stringify(d1.applicability));
  const notObsMatch = s1.match(/What Was Not Observed[\s\S]{0,300}/);
  if (notObsMatch) console.log(notObsMatch[0].substring(0, 200));
  
  // Run 2: landing-with-login
  const r2 = await executeReality({
    baseUrl: `${fixture.baseUrl}/landing-with-login`,
    artifactsDir: ".odavlguardian/e2e-broken",
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: true,
    maxPages: 5,
    maxDepth: 2
  });
  const d2 = JSON.parse(fs.readFileSync(".odavlguardian/e2e-broken/decision.json"));
  const s2 = fs.readFileSync(".odavlguardian/e2e-broken/summary.txt", "utf8");
  console.log("\n=== RUN 2: /landing-with-login ===");
  console.log("Verdict:", d2.finalVerdict, "Exit:", r2.exitCode);
  console.log("ObservedCaps:", JSON.stringify(d2.observedCapabilities));
  console.log("Applicability:", JSON.stringify(d2.applicability));
  const failMatch = s2.match(/Could Not Confirm[\s\S]{0,300}/);
  if (failMatch) console.log(failMatch[0].substring(0, 200));
  
  // Run 3: landing-with-admin
  const r3 = await executeReality({
    baseUrl: `${fixture.baseUrl}/landing-with-admin`,
    artifactsDir: ".odavlguardian/e2e-admin",
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: true,
    maxPages: 5,
    maxDepth: 2
  });
  const d3 = JSON.parse(fs.readFileSync(".odavlguardian/e2e-admin/decision.json"));
  const s3 = fs.readFileSync(".odavlguardian/e2e-admin/summary.txt", "utf8");
  console.log("\n=== RUN 3: /landing-with-admin ===");
  console.log("Verdict:", d3.finalVerdict, "Exit:", r3.exitCode);
  console.log("ObservedCaps:", JSON.stringify(d3.observedCapabilities));
  console.log("Applicability:", JSON.stringify(d3.applicability));
  const adminMatch = s3.match(/Internal Surface[\s\S]{0,300}/);
  if (adminMatch) console.log(adminMatch[0].substring(0, 200));
  
  await fixture.close();
  process.exit(0);
}
run().catch(e => {console.error(e); process.exit(1);});
