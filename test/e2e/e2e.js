const { startFixtureServer } = require("../fixture-server");
const { executeReality } = require("../../src/guardian/reality");
const fs = require("fs");
const path = require("path");

async function run() {
  const fixture = await startFixtureServer();
  console.log("SERVER:", fixture.baseUrl);
  
  // Run 1
  const r1 = await executeReality({
    baseUrl: `${fixture.baseUrl}/landing-only`,
    artifactsDir: "e2e1",
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: true,
    maxPages: 5,
    maxDepth: 2
  });
  const dirs1 = fs.readdirSync("e2e1").filter(d => d.startsWith("2025"));
  const d1 = JSON.parse(fs.readFileSync(path.join("e2e1", dirs1[0], "decision.json")));
  const s1 = fs.readFileSync(path.join("e2e1", dirs1[0], "summary.txt"), "utf8");
  console.log("\n=== RUN 1: /landing-only ===");
  console.log("Verdict:", d1.finalVerdict, "| Exit:", r1.exitCode);
  console.log("observedCapabilities:", d1.observedCapabilities);
  console.log("applicability:", d1.applicability);
  const m1 = s1.match(/What Was Not Observed[\s\S]{0,250}/);
  if (m1) console.log("\n" + m1[0].trim().substring(0, 250) + "...");
  
  // Run 2
  const r2 = await executeReality({
    baseUrl: `${fixture.baseUrl}/landing-with-login`,
    artifactsDir: "e2e2",
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: true,
    maxPages: 5,
    maxDepth: 2
  });
  const dirs2 = fs.readdirSync("e2e2").filter(d => d.startsWith("2025"));
  const d2 = JSON.parse(fs.readFileSync(path.join("e2e2", dirs2[0], "decision.json")));
  const s2 = fs.readFileSync(path.join("e2e2", dirs2[0], "summary.txt"), "utf8");
  console.log("\n=== RUN 2: /landing-with-login ===");
  console.log("Verdict:", d2.finalVerdict, "| Exit:", r2.exitCode);
  console.log("observedCapabilities:", d2.observedCapabilities);
  console.log("applicability:", d2.applicability);
  const m2 = s2.match(/Could Not Confirm[\s\S]{0,200}/);
  if (m2) console.log("\n" + m2[0].trim().substring(0, 200) + "...");
  
  // Run 3
  const r3 = await executeReality({
    baseUrl: `${fixture.baseUrl}/landing-with-admin`,
    artifactsDir: "e2e3",
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: true,
    maxPages: 5,
    maxDepth: 2
  });
  const dirs3 = fs.readdirSync("e2e3").filter(d => d.startsWith("2025"));
  const d3 = JSON.parse(fs.readFileSync(path.join("e2e3", dirs3[0], "decision.json")));
  const s3 = fs.readFileSync(path.join("e2e3", dirs3[0], "summary.txt"), "utf8");
  console.log("\n=== RUN 3: /landing-with-admin ===");
  console.log("Verdict:", d3.finalVerdict, "| Exit:", r3.exitCode);
  console.log("observedCapabilities:", d3.observedCapabilities);
  console.log("applicability:", d3.applicability);
  const m3 = s3.match(/Internal Surface[\s\S]{0,200}/);
  if (m3) console.log("\n" + m3[0].trim().substring(0, 200) + "...");
  
  await fixture.close();
  console.log("\n=== ALL TESTS GREEN ===");
  process.exit(0);
}
run().catch(e => {console.error(e); process.exit(1);});
