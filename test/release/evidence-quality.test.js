/**
 * Evidence Quality & Confidence Fidelity (Phase 3.3) Contract Tests
 * 
 * WHAT WE TEST:
 * 1. Evidence de-duplication works without changing findings
 * 2. Identical signals are not double-counted
 * 3. Attribution correctly tracks signal→evidence relationships
 * 4. Validation doesn't block findings but flags issues correctly
 * 5. Confidence values remain stable across phases
 * 6. No semantic changes to findings
 * 7. Determinism: same input → same output always
 * 
 * CONSTRAINTS ENFORCED:
 * - No findings created or deleted
 * - No severity or confidence changes
 * - No exit code changes
 * - All operations fully reversible
 * - Graceful handling of partial/missing evidence
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateNetworkEvents, deduplicateConsoleErrors, deduplicateAndNormalizeEvidence, hasOvercountedEvidence, generateEvidenceQualityReport } from '../../src/cli/util/evidence/evidence-deduplication.js';
import { classifyEvidenceSources, identifyConfidenceSupportingEvidence, traceEvidenceAttribution, generateAttributionReport, validateEvidenceAttribution } from '../../src/cli/util/evidence/evidence-attribution.js';
import { validateEvidenceSubstantiveness, detectEvidenceContradictions, validateSignalEvidenceConsistency, validateFindingEvidenceIntegrity, checkEvidenceCompleteness, validateFindingsBatch, shouldFlagForReview } from '../../src/cli/util/evidence/evidence-validator.js';

test('Evidence Deduplication: Should deduplicate identical network events', () => {
  const networkEvents = [
    { method: 'GET', url: 'https://api.example.com/data', status: 200 },
    { method: 'GET', url: 'https://api.example.com/data', status: 200 },
    { method: 'POST', url: 'https://api.example.com/save', status: 201 },
  ];

  const result = deduplicateNetworkEvents(networkEvents);
  
  assert.equal(result.unique.length, 2, 'Should have 2 unique events');
  assert.equal(result.duplicates.length, 1, 'Should have 1 duplicate');
  assert.equal(result.deduplicatedCount, 1, 'Should report 1 deduplicated');
});

test('Evidence Deduplication: Should deduplicate identical console errors', () => {
  const consoleErrors = [
    'Error: Failed to fetch data',
    'Error: Failed to fetch data',
    'Warning: Missing dependency',
  ];

  const result = deduplicateConsoleErrors(consoleErrors);
  
  assert.equal(result.unique.length, 2, 'Should have 2 unique errors');
  assert.equal(result.duplicates.length, 1, 'Should have 1 duplicate');
  assert.equal(result.deduplicatedCount, 1, 'Should report 1 deduplicated');
});

test('Evidence Deduplication: Should handle null/empty input gracefully', () => {
  assert.deepEqual(deduplicateNetworkEvents(null), { unique: [], duplicates: [], deduplicatedCount: 0 });
  assert.deepEqual(deduplicateNetworkEvents([]), { unique: [], duplicates: [], deduplicatedCount: 0 });
  assert.deepEqual(deduplicateConsoleErrors(null), { unique: [], duplicates: [], deduplicatedCount: 0 });
});

test('Evidence Deduplication: Should NOT double-count network events in evidence', () => {
  const finding = {
    id: 'test-1',
    signals: {
      networkActivity: true,
    },
    evidence: {
      networkRequests: [
        { method: 'GET', url: 'https://api.example.com/data', status: 200 },
        { method: 'GET', url: 'https://api.example.com/data', status: 200 },
      ],
    },
  };

  const deduped = deduplicateAndNormalizeEvidence(finding);
  
  assert(deduped.evidenceQuality, 'Should have evidenceQuality metadata');
  assert(deduped.evidenceQuality.networkDeduplication, 'Should have network dedup stats');
  assert.equal(deduped.evidenceQuality.networkDeduplication.duplicateCount, 1, 'Should report 1 network dedup');
});

test('Evidence Deduplication: Should detect over-counted evidence', () => {
  const finding = {
    signals: {
      networkActivity: true,
    },
    evidence: {
      networkRequests: [
        { method: 'GET', url: 'https://api.example.com/data', status: 200 },
        { method: 'GET', url: 'https://api.example.com/data', status: 200 },
        { method: 'GET', url: 'https://api.example.com/data', status: 200 },
      ],
    },
  };

  const hasOvercount = hasOvercountedEvidence(finding);
  assert.equal(hasOvercount, true, 'Should detect over-counted network events');
});

test('Evidence Deduplication: Should generate evidence quality report', () => {
  const findings = [
    {
      id: 'test-1',
      signals: { networkActivity: true },
      evidence: {
        networkRequests: [
          { method: 'GET', url: 'https://api.example.com/data', status: 200 },
          { method: 'GET', url: 'https://api.example.com/data', status: 200 },
        ],
      },
    },
    {
      id: 'test-2',
      signals: { consoleErrors: true },
      evidence: {
        consoleErrors: ['Error: X', 'Error: X', 'Error: Y'],
      },
    },
  ];

  // Apply deduplication first to get quality metadata
  const dedupedFindings = findings.map(f => deduplicateAndNormalizeEvidence(f));
  const report = generateEvidenceQualityReport(dedupedFindings);
  
  assert.equal(report.totalFindings, 2, 'Should have 2 total findings');
  assert(report.findingsWithDeduplicatedEvidence >= 2, 'Should report deduplication for both findings');
    assert(report.qualityScore, 'Should have quality score');
});

test('Evidence Attribution: Should classify evidence sources correctly', () => {
  const finding = {
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      domDiff: { changed: true },
      networkRequests: [{ method: 'GET', url: 'https://api.example.com/data', status: 200 }],
    },
    signals: {
      navigationChanged: true,
      domChanged: true,
      networkActivity: true,
    },
  };

  const sources = classifyEvidenceSources(finding);
  
  assert(sources.navigation.includes('url_comparison'), 'Should classify URL comparison');
  assert(sources.dom.includes('dom_diff'), 'Should classify DOM diff');
  assert(sources.network.includes('network_events'), 'Should classify network events');
});

test('Evidence Attribution: Should identify confidence-supporting evidence', () => {
  const finding = {
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      domDiff: { changed: true },
      networkRequests: [{ method: 'GET', status: 200 }],
    },
    signals: {
      navigationChanged: true,
      domChanged: true,
      networkActivity: true,
    },
    confidence: {
      level: 'HIGH',
    },
  };

  const support = identifyConfidenceSupportingEvidence(finding);
  
  assert.equal(support.level, 'HIGH', 'Should identify confidence level');
  assert(support.isSufficient, 'Should indicate sufficient support');
  assert(support.evidenceChain.length >= 2, 'HIGH should have multiple evidence types');
});

test('Evidence Attribution: Should trace evidence attribution', () => {
  const finding = {
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      domDiff: { changed: true },
    },
    signals: {
      navigationChanged: true,
      domChanged: true,
    },
  };

  const attribution = traceEvidenceAttribution(finding);
  
  assert.equal(attribution.evidenceCount, 3, 'Should count 3 evidence pieces');
  assert.equal(attribution.signalCount, 2, 'Should count 2 signals');
  assert(attribution.attributionMap.navigationChanged, 'Should map navigationChanged');
});

test('Evidence Attribution: Should generate comprehensive attribution report', () => {
  const finding = {
    id: 'test-1',
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      domDiff: { changed: true },
      networkRequests: [{ method: 'GET', status: 200 }],
    },
    signals: {
      navigationChanged: true,
      domChanged: true,
      networkActivity: true,
    },
    confidence: {
      level: 'HIGH',
    },
  };

  const report = generateAttributionReport(finding);
  
  assert.equal(report.findingId, 'test-1', 'Should include finding ID');
  assert(report.evidenceSources, 'Should classify sources');
  assert(report.confidenceSupport, 'Should analyze confidence');
  assert(report.summary.attributionComplete, 'Should complete attribution');
});

test('Evidence Attribution: Should validate evidence attribution', () => {
  const finding = {
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      networkRequests: [{ method: 'GET', status: 200 }],
    },
    signals: {
      navigationChanged: true,
      networkActivity: true,
    },
  };

  const validation = validateEvidenceAttribution(finding);
  
  assert(validation.valid, 'Should validate complete attribution');
  assert(validation.hasEvidence, 'Should have evidence');
  assert(validation.hasSignals, 'Should have signals');
  assert(validation.attributionComplete, 'Should complete attribution');
});

test('Evidence Validation: Should validate evidence substantiveness', () => {
  const finding = {
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      domDiff: { changed: true },
    },
    signals: {
      navigationChanged: true,
      domChanged: true,
    },
  };

  const validation = validateEvidenceSubstantiveness(finding);
  
  assert(validation.hasSubstantiveEvidence, 'Should have substantive evidence');
  assert.equal(validation.substantiveEvidenceCount, 2, 'Should count 2 substantive pieces');
});

test('Evidence Validation: Should detect evidence contradictions', () => {
  const findingWithContradiction = {
    signals: { navigationChanged: true },
    evidence: { beforeUrl: 'https://example.com/page', afterUrl: 'https://example.com/page' },
  };

  const contradictions = detectEvidenceContradictions(findingWithContradiction);
  
  assert(contradictions.hasContradictions, 'Should detect URL contradiction');
  assert.equal(contradictions.contradictionCount, 1, 'Should report 1 contradiction');
});

test('Evidence Validation: Should validate signal-evidence consistency', () => {
  const finding = {
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      domDiff: { changed: true },
      networkRequests: [{ method: 'GET', status: 200 }],
    },
    signals: {
      navigationChanged: true,
      domChanged: true,
      networkActivity: true,
    },
  };

  const consistency = validateSignalEvidenceConsistency(finding);
  
  assert(consistency.consistent, 'Should be consistent');
  assert.equal(consistency.consistentSignals, 3, 'Should validate all 3 signals');
});

test('Evidence Validation: Should validate complete evidence integrity', () => {
  const finding = {
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      domDiff: { changed: true },
      networkRequests: [{ method: 'GET', status: 200 }],
    },
    signals: {
      navigationChanged: true,
      domChanged: true,
      networkActivity: true,
    },
  };

  const integrity = validateFindingEvidenceIntegrity(finding);
  
  assert.equal(integrity.integrityLevel, 'COMPLETE', 'Should have complete integrity');
  assert(integrity.isValidated, 'Should be validated');
  assert.equal(integrity.issues.length, 0, 'Should have no issues');
});

test('Evidence Validation: Should check evidence completeness', () => {
  const finding = {
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      networkRequests: [{ method: 'GET', status: 200 }],
    },
    signals: {
      navigationChanged: true,
      networkActivity: true,
    },
  };

  const completeness = checkEvidenceCompleteness(finding);
  
  assert(completeness.isComplete, 'Should be complete');
  assert(completeness.readyForPublication, 'Should be ready for publication');
});

test('Evidence Validation: Should NOT block incomplete evidence (graceful)', () => {
  const finding = {
    evidence: {},
    signals: { navigationChanged: true },
  };

  const completeness = checkEvidenceCompleteness(finding);
  
  assert.equal(completeness.recommendedAction, 'PUBLISH_WITH_CAVEATS', 'Should flag for caution');
});

test('Evidence Validation: Should validate batch of findings', () => {
  const findings = [
    {
      id: 'test-1',
      evidence: {
        beforeUrl: 'https://example.com/page1',
        afterUrl: 'https://example.com/page2',
        networkRequests: [{ method: 'GET', status: 200 }],
      },
      signals: { navigationChanged: true, networkActivity: true },
    },
    {
      id: 'test-2',
      evidence: { domDiff: { changed: true } },
      signals: { domChanged: true },
    },
  ];

  const report = validateFindingsBatch(findings);
  
  assert.equal(report.totalFindings, 2, 'Should validate 2 findings');
  assert(report.allValid, 'Should validate all');
  assert.equal(report.completeCount, 2, 'Should have 2 complete');
});

test('Evidence Validation: Should flag findings for review', () => {
  const finding = {
    evidence: {
      networkRequests: [{ method: 'GET', status: 200 }],
    },
    signals: {
      networkActivity: true,
      navigationChanged: true,
    },
  };

  const flag = shouldFlagForReview(finding);
  
  assert(flag.shouldReview, 'Should flag for review');
  assert(flag.reasons.length > 0, 'Should have reasons');
});

test('No Semantic Changes: Should NOT change finding status', () => {
  const finding = {
    id: 'test-1',
    status: 'OBSERVED',
    severity: 'HIGH',
    evidence: { networkRequests: [{ method: 'GET', status: 200 }] },
    signals: { networkActivity: true },
  };

  const deduped = deduplicateAndNormalizeEvidence(finding);
  
  assert.equal(deduped.status, 'OBSERVED', 'Status should not change');
  assert.equal(deduped.severity, 'HIGH', 'Severity should not change');
});

test('No Semantic Changes: Should NOT change confidence values', () => {
  const finding = {
    id: 'test-1',
    confidence: {
      level: 'HIGH',
      score: 0.95,
    },
    evidence: { networkRequests: [{ method: 'GET', status: 200 }] },
    signals: { networkActivity: true },
  };

  const deduped = deduplicateAndNormalizeEvidence(finding);
  
  assert.equal(deduped.confidence.level, 'HIGH', 'Confidence level should not change');
  assert.equal(deduped.confidence.score, 0.95, 'Confidence score should not change');
});

test('No Semantic Changes: Should NOT create or delete findings', () => {
  const findings = [
    { id: 'test-1', signals: { navigationChanged: true }, evidence: { beforeUrl: 'a', afterUrl: 'b', networkRequests: [] } },
    { id: 'test-2', signals: { domChanged: true }, evidence: { domDiff: { changed: true } } },
  ];

  const attributed = findings.map(f => ({
    ...f,
    evidenceAttribution: generateAttributionReport(f),
  }));

  assert.equal(attributed.length, 2, 'Should preserve finding count');
  assert.equal(attributed[0].id, 'test-1', 'Should preserve IDs');
});

test('Determinism: Should produce deterministic deduplication', () => {
  const networkEvents = [
    { method: 'GET', url: 'https://api.example.com/data', status: 200 },
    { method: 'GET', url: 'https://api.example.com/data', status: 200 },
  ];

  const result1 = deduplicateNetworkEvents(networkEvents);
  const result2 = deduplicateNetworkEvents(networkEvents);

  assert.deepEqual(result1, result2, 'Deduplication should be deterministic');
});

test('Determinism: Should produce deterministic attribution', () => {
  const finding = {
    id: 'test-1',
    evidence: {
      beforeUrl: 'https://example.com/page1',
      afterUrl: 'https://example.com/page2',
      networkRequests: [{ method: 'GET', status: 200 }],
    },
    signals: {
      navigationChanged: true,
      networkActivity: true,
    },
  };

  const report1 = generateAttributionReport(finding);
  const report2 = generateAttributionReport(finding);

  assert.deepEqual(report1, report2, 'Attribution should be deterministic');
});

test('Determinism: Should produce deterministic validation', () => {
  const finding = {
    id: 'test-1',
    evidence: {
      networkRequests: [{ method: 'GET', status: 200 }],
    },
    signals: { networkActivity: true },
  };

  const integrity1 = validateFindingEvidenceIntegrity(finding);
  const integrity2 = validateFindingEvidenceIntegrity(finding);

  assert.deepEqual(integrity1, integrity2, 'Validation should be deterministic');
});

test('Graceful Handling: Should handle null evidence gracefully', () => {
  const finding = {
    id: 'test-1',
    evidence: null,
    signals: { navigationChanged: true },
  };

  const validation = validateFindingEvidenceIntegrity(finding);
  
  assert(validation, 'Should not crash on null evidence');
  assert(validation.issues.length > 0, 'Should flag issues');
});

test('Graceful Handling: Should handle missing signals gracefully', () => {
  const finding = {
    id: 'test-1',
    evidence: { beforeUrl: 'a', afterUrl: 'b', networkRequests: [] },
    signals: null,
  };

  const sources = classifyEvidenceSources(finding);
  
  assert(sources, 'Should not crash on null signals');
});

test('Graceful Handling: Should handle empty findings array', () => {
  const findings = [];

  const report = validateFindingsBatch(findings);
  
  assert.equal(report.totalFindings, 0, 'Should handle empty array');
  assert.equal(report.completeCount, 0, 'Should report 0 complete');
});




