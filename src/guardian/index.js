const os = require('os');
const path = require('path');
const { GuardianBrowser } = require('./browser');
const { GuardianCrawler } = require('./crawler');
const { GuardianReporter } = require('./reporter');
const GuardianScreenshot = require('./screenshot');
const GuardianNetworkTrace = require('./network-trace');
const GuardianSitemap = require('./sitemap');
const GuardianSafety = require('./safety');
const GuardianFlowExecutor = require('./flow-executor');
const GuardianHTMLReporter = require('./html-reporter');

async function runGuardian(config) {
  const {
    baseUrl,
    maxPages = 25,
    maxDepth = 3,
    timeout = 20000,
    artifactsDir = path.join(os.tmpdir(), 'odavlguardian-artifacts'),
    // Phase 2 features
    enableScreenshots = true,
    enableTrace = true,
    enableHAR = true,
    enableSitemap = true,
    enableSafety = true,
    enableHTMLReport = true,
    flowPath = null, // Path to flow JSON file
  } = config;

  // Validate baseUrl
  try {
    new URL(baseUrl);
  } catch (e) {
    console.error(`❌ Invalid URL: ${baseUrl}`);
    process.exit(2);
  }

  console.log(`\n🛡️  ODAVL Guardian — Market Reality Testing Engine`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 Target: ${baseUrl}`);
  console.log(`⚙️  Config: max-pages=${maxPages}, max-depth=${maxDepth}, timeout=${timeout}ms`);
  
  // Initialize modules
  const screenshot = enableScreenshots ? new GuardianScreenshot() : null;
  const networkTrace = (enableHAR || enableTrace) ? new GuardianNetworkTrace({ enableHAR, enableTrace }) : null;
  const sitemap = enableSitemap ? new GuardianSitemap() : null;
  const safety = enableSafety ? new GuardianSafety() : null;
  const flowExecutor = flowPath ? new GuardianFlowExecutor({ safety, screenshotOnStep: enableScreenshots }) : null;
  const htmlReporter = enableHTMLReport ? new GuardianHTMLReporter() : null;

  const browser = new GuardianBrowser();
  
  try {
    // Discover URLs from sitemap (if enabled)
    let sitemapUrls = [];
    if (sitemap) {
      const sitemapResult = await sitemap.discover(baseUrl);
      if (sitemapResult.urls.length > 0) {
        sitemapUrls = sitemap.filterSameOrigin(sitemapResult.urls, baseUrl);
        console.log(`🗺️  Sitemap: Discovered ${sitemapUrls.length} URLs`);
      }
    }

    // Launch browser
    console.log(`\n🚀 Launching browser...`);
    const launchOptions = {};
    
    // Enable HAR if requested
    if (networkTrace && enableHAR) {
      // HAR must be configured before context creation
      launchOptions.recordHar = true;
    }
    
    await browser.launch(timeout, launchOptions);
    console.log(`✅ Browser launched`);
    
    // Start trace recording if enabled
    let tracePath = null;
    if (networkTrace && enableTrace && browser.context) {
      const reporter = new GuardianReporter();
      const { runDir } = reporter.prepareArtifactsDir(artifactsDir);
      tracePath = await networkTrace.startTrace(browser.context, runDir);
      if (tracePath) {
        console.log(`📹 Trace recording started`);
      }
    }

    // Flow execution OR crawling
    let crawlResult = null;
    let flowResult = null;
    
    if (flowExecutor && flowPath) {
      // Execute flow instead of crawling
      console.log(`\n🎬 Flow execution mode`);
      const flow = flowExecutor.loadFlow(flowPath);
      
      if (!flow) {
        throw new Error(`Failed to load flow from: ${flowPath}`);
      }
      
      const validation = flowExecutor.validateFlow(flow);
      if (!validation.valid) {
        throw new Error(`Invalid flow: ${validation.errors.join(', ')}`);
      }
      
      const reporter = new GuardianReporter();
      const { runDir } = reporter.prepareArtifactsDir(artifactsDir);
      
      flowResult = await flowExecutor.executeFlow(browser.page, flow, runDir);
      
      if (!flowResult.success) {
        console.log(`❌ Flow failed at step ${flowResult.failedStep}: ${flowResult.error}`);
      }
    } else {
      // Normal crawling mode
      console.log(`\n🔍 Starting crawl...`);
      const crawler = new GuardianCrawler(baseUrl, maxPages, maxDepth);
      
      // Add sitemap URLs to crawler if available
      if (sitemapUrls.length > 0) {
        crawler.discovered = new Set([...crawler.discovered, ...sitemapUrls]);
      }
      
      // Add safety guard to crawler
      if (safety) {
        crawler.safety = safety;
      }
      
      // Add screenshot capability
      if (screenshot) {
        crawler.screenshot = screenshot;
      }
      
      // Prepare artifacts directory
      const reporter = new GuardianReporter();
      const { runDir } = reporter.prepareArtifactsDir(artifactsDir);
      
      crawlResult = await crawler.crawl(browser, runDir);
      
      console.log(`✅ Crawl complete: visited ${crawlResult.totalVisited}/${crawlResult.totalDiscovered} pages`);
      
      if (safety && crawlResult.safetyStats) {
        const blocked = crawlResult.safetyStats.urlsBlocked || 0;
        if (blocked > 0) {
          console.log(`🛡️  Safety: Blocked ${blocked} dangerous URLs`);
        }
      }
    }

    // Stop trace recording
    if (networkTrace && enableTrace && tracePath && browser.context) {
      await networkTrace.stopTrace(browser.context, tracePath);
      console.log(`✅ Trace saved: trace.zip`);
    }

    // Generate report
    console.log(`\n📊 Generating report...`);
    const reporter = new GuardianReporter();
    
    let report;
    if (flowResult) {
      // Create report from flow execution
      report = reporter.createFlowReport(flowResult, baseUrl);
    } else {
      // Create report from crawl
      report = reporter.createReport(crawlResult, baseUrl);
    }
    
    // Save JSON report
    const savedReport = reporter.saveReport(report, artifactsDir);
    console.log(`✅ Report saved to: ${savedReport.runDir}`);
    
    // Generate HTML report if enabled
    if (htmlReporter) {
      const htmlSaved = htmlReporter.generateAndSave(report, savedReport.runDir);
      if (htmlSaved) {
        console.log(`✅ HTML report: report.html`);
      }
    }

    // Display verdict with evidence-first messaging
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const { decision, reasons } = report.finalJudgment;
    const coverageStr = `${report.summary.coverage}%`;

    // Map internal to canonical verdict labels for CLI output
    const { toCanonicalVerdict } = require('./verdicts');
    const canonical = toCanonicalVerdict(decision);
    const verdictLabel = canonical === 'READY'
      ? 'READY — flows seen end-to-end'
      : canonical === 'FRICTION'
        ? 'FRICTION — some flows failed or could not be confirmed'
        : 'DO_NOT_LAUNCH — only limited observations or critical failures'

    console.log(`\n🔎 Verdict: ${verdictLabel}`);
    console.log(`\n📈 Coverage (link discovery only): ${coverageStr}`);
    console.log(`📄 Pages visited: ${report.summary.visitedPages}`);
    console.log(`❌ Failed pages (server/nav errors): ${report.summary.failedPages}`);
    console.log(`💬 Confidence: ${report.confidence.level}`);

    console.log(`\nEvidence and limitations:`);
    reasons.forEach(reason => {
      console.log(`   • ${reason}`);
    });

    console.log(`\n💾 Full report: ${savedReport.reportPath}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Exit with deterministic codes: OBSERVED=0, PARTIAL=1, INSUFFICIENT_DATA=2
    const { mapExitCodeFromCanonical } = require('./verdicts');
    const exitCode = mapExitCodeFromCanonical(canonical);
    process.exit(exitCode);

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(2);
  } finally {
    await browser.close();
  }
}

module.exports = { runGuardian };
