/**
 * EXPECTATION CHAIN DETECTION
 * 
 * Detects silent failures where a sequence of promised user expectations breaks mid-journey.
 * 
 * Requirements:
 * 1) Build expectation chains from source-derived expectations:
 *    - navigation → content → next action
 * 2) Track which chain steps were fulfilled vs broken
 * 3) Emit finding type: "expectation-chain-break"
 * 4) Include metadata:
 *    - chainLength
 *    - fulfilledSteps
 *    - brokenStepIndex
 * 5) Confidence rules:
 *    - Longer chains + late break = higher confidence
 */

/**
 * Expectation Chain Detector
 * 
 * Analyzes sequences of proven expectations to detect when they break
 * in a predictable chain pattern.
 */
export class ExpectationChainDetector {
  constructor(options = {}) {
    this.minChainLength = options.minChainLength || 2; // Minimum 2 for a "chain"
    this.maxChainLength = options.maxChainLength || 10; // Limit to 10 for analysis
  }

  /**
   * Detect expectation chains that break
   * @param {Array} expectations - Proven expectations from source analysis
   * @param {Array} traces - Interaction traces from observe phase
   * @returns {Array} Expectation chain break findings
   */
  detectChainBreaks(expectations = [], traces = []) {
    if (!Array.isArray(expectations) || !Array.isArray(traces)) {
      return [];
    }

    const findings = [];

    // Build expectation chains from proven expectations
    const chains = this._buildChains(expectations);

    // Validate each chain against traces
    for (const chain of chains) {
      const chainBreak = this._validateChain(chain, traces);
      if (chainBreak) {
        findings.push(chainBreak);
      }
    }

    return findings;
  }

  /**
   * Build expectation chains from a list of expectations
   * Chain pattern: navigation → content → interaction
   * @private
   */
  _buildChains(expectations) {
    const chains = [];

    // Filter to PROVEN expectations only
    const provenExpectations = expectations.filter(exp => this._isProven(exp));

    if (provenExpectations.length < this.minChainLength) {
      return chains;
    }

    // Group expectations by sequence/order
    const ordered = this._orderExpectationsBySequence(provenExpectations);

    // Build chains from consecutive expectations
    let currentChain = [];
    for (let i = 0; i < ordered.length; i++) {
      const exp = ordered[i];

      // Add to current chain
      currentChain.push({
        index: i,
        expectation: exp,
        type: this._normalizeExpectationType(exp),
        sourceRef: exp.sourceRef || exp.filename,
        lineNumber: exp.lineNumber
      });

      // Check if chain should end
      const isLastExp = i === ordered.length - 1;
      const nextExp = !isLastExp ? ordered[i + 1] : null;

      // Chain ends if:
      // 1. Gap in expectation sequence (next type is unrelated)
      // 2. Chain is at max length
      // 3. We're at the end
      const shouldBreakChain =
        currentChain.length >= this.maxChainLength ||
        isLastExp ||
        (nextExp && !this._isConsecutiveExpectation(exp, nextExp));

      if (shouldBreakChain && currentChain.length >= this.minChainLength) {
        chains.push(currentChain);
        currentChain = [];
      }
    }

    return chains;
  }

  /**
   * Validate a chain against actual traces
   * Returns finding if chain breaks (some steps work, later steps fail)
   * @private
   */
  _validateChain(chain, traces) {
    if (chain.length < this.minChainLength) {
      return null;
    }

    let fulfilledSteps = 0;
    let brokenStepIndex = -1;

    // Check each step in the chain
    for (let i = 0; i < chain.length; i++) {
      const step = chain[i];
      const _stepType = step.type;

      // Find matching trace for this step
      const matchingTrace = traces.find(trace =>
        this._traceMatchesExpectation(trace, step.expectation)
      );

      if (!matchingTrace) {
        // Step not found in traces - chain breaks here
        brokenStepIndex = i;
        break;
      }

      // Check if step expectation was fulfilled
      const isFulfilled = this._isExpectationFulfilled(
        step.expectation,
        matchingTrace
      );

      if (isFulfilled) {
        fulfilledSteps++;
      } else {
        // Expectation exists but not fulfilled
        brokenStepIndex = i;
        break;
      }
    }

    // Only emit finding if:
    // 1. Chain had at least 1 fulfilled step before breaking
    // 2. Breaking happened (not all steps fulfilled)
    if (brokenStepIndex > 0 && fulfilledSteps > 0) {
      return {
        id: `expectation-chain-break-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`,
        type: 'expectation-chain-break',
        severity: this._computeSeverity(chain.length, fulfilledSteps, brokenStepIndex),
        evidence: {
          chainLength: chain.length,
          fulfilledSteps,
          brokenStepIndex,
          chain: chain.map(step => ({
            type: step.type,
            sourceRef: step.sourceRef,
            lineNumber: step.lineNumber
          })),
          brokenStep: chain[brokenStepIndex]
            ? {
                type: chain[brokenStepIndex].type,
                sourceRef: chain[brokenStepIndex].sourceRef,
                lineNumber: chain[brokenStepIndex].lineNumber
              }
            : null,
          description: this._describeChainBreak(
            chain,
            fulfilledSteps,
            brokenStepIndex
          )
        },
        expectation: {
          proof: 'PROVEN_EXPECTATION',
          explicit: true,
          evidence: {
            source: 'expectation-chain-analysis',
            chainAnalysis: true
          }
        },
        actualOutcome: 'expectation_chain_breaks_at_step',
        impact: 'HIGH'
      };
    }

    return null;
  }

  /**
   * Check if trace matches expectation
   * @private
   */
  _traceMatchesExpectation(trace, expectation) {
    if (!trace || !expectation) return false;

    // Match by route if available
    if (expectation.route && trace.after?.url) {
      const routePath = expectation.route.replace(/\/$/, '') || '/';
      const urlPath = this._getUrlPath(trace.after.url);
      return routePath === urlPath;
    }

    // Match by type
    const expType = this._normalizeExpectationType(expectation);
    if (
      expType === 'navigation' &&
      trace.interaction?.type === 'link'
    ) {
      return true;
    }

    if (
      expType === 'form_submission' &&
      trace.interaction?.type === 'form'
    ) {
      return true;
    }

    if (expType === 'interaction' && trace.interaction) {
      return true;
    }

    return false;
  }

  /**
   * Check if expectation was fulfilled in the trace
   * @private
   */
  _isExpectationFulfilled(expectation, trace) {
    if (!trace) return false;

    const expType = this._normalizeExpectationType(expectation);

    // Navigation expectation: URL must change
    if (expType === 'navigation') {
      const urlChanged = trace.sensors?.navigation?.urlChanged === true;
      const afterUrl = trace.after?.url;
      return urlChanged && afterUrl !== trace.before?.url;
    }

    // Content expectation: DOM must change
    if (expType === 'content') {
      const domChanged = trace.sensors?.uiSignals?.diff?.domChanged === true;
      const newContent =
        trace.sensors?.uiFeedback?.signals?.domChange?.happened === true;
      return domChanged || newContent;
    }

    // Interaction expectation: must have been performed
    if (expType === 'interaction') {
      const performed = trace.interaction?.performed === true;
      return performed;
    }

    // Form submission: must have network request
    if (expType === 'form_submission') {
      const hasNetworkRequest = (trace.sensors?.network?.totalRequests || 0) > 0;
      return hasNetworkRequest;
    }

    // Default: consider fulfilled if trace exists
    return true;
  }

  /**
   * Check if expectation is PROVEN
   * @private
   */
  _isProven(expectation) {
    if (!expectation) return false;

    // Explicit from source code analysis
    if (expectation.explicit === true) return true;

    // Has proof marker
    if (expectation.proof === 'PROVEN_EXPECTATION') return true;

    // Has sourceRef (AST-derived)
    if (expectation.sourceRef) return true;

    // Has source evidence
    if (expectation.evidence?.source) return true;

    return false;
  }

  /**
   * Normalize expectation type
   * @private
   */
  _normalizeExpectationType(expectation) {
    if (!expectation) return 'unknown';

    const type = expectation.type || expectation.expectationType || '';

    if (type.includes('navigation') || type === 'spa_navigation') {
      return 'navigation';
    }
    if (type.includes('content') || type.includes('dom')) {
      return 'content';
    }
    if (type.includes('form') || type === 'form_submission') {
      return 'form_submission';
    }
    if (type.includes('interaction') || type.includes('action')) {
      return 'interaction';
    }

    return type || 'unknown';
  }

  /**
   * Order expectations by sequence (chain order)
   * @private
   */
  _orderExpectationsBySequence(expectations) {
    // If expectations have explicit order/lineNumber, use that
    const withOrder = expectations.filter(exp => exp.lineNumber !== undefined);
    if (withOrder.length > 0) {
      return withOrder.sort((a, b) => a.lineNumber - b.lineNumber);
    }

    // Otherwise return in given order
    return expectations;
  }

  /**
   * Check if two expectations are consecutive in chain
   * @private
   */
  _isConsecutiveExpectation(currentExp, nextExp) {
    if (!currentExp || !nextExp) return false;

    const currentType = this._normalizeExpectationType(currentExp);
    const nextType = this._normalizeExpectationType(nextExp);

    // Valid chain progressions:
    // navigation → content, interaction, form_submission
    // content → interaction, form_submission
    // form_submission → content, navigation
    // interaction → content, form_submission, navigation

    const validProgressions = {
      navigation: ['content', 'interaction', 'form_submission'],
      content: ['interaction', 'form_submission', 'navigation'],
      form_submission: ['content', 'navigation', 'interaction'],
      interaction: ['content', 'form_submission', 'navigation']
    };

    const validNext = validProgressions[currentType] || [];
    return validNext.includes(nextType);
  }

  /**
   * Compute severity based on chain depth and break position
   * @private
   */
  _computeSeverity(chainLength, fulfilledSteps, brokenStepIndex) {
    // Late breaks (deeper in chain) are higher severity
    const breakDepth = brokenStepIndex / chainLength;

    if (breakDepth >= 0.7) {
      return 'CRITICAL'; // Broke in final 30%
    }
    if (breakDepth >= 0.5) {
      return 'HIGH'; // Broke in second half
    }
    if (breakDepth >= 0.3) {
      return 'MEDIUM'; // Broke in second third
    }
    return 'LOW'; // Early break
  }

  /**
   * Generate description of chain break
   * @private
   */
  _describeChainBreak(chain, fulfilledSteps, brokenStepIndex) {
    const chainTypes = chain.map(s => s.type).join(' → ');
    const brokenType = chain[brokenStepIndex]?.type || 'unknown';

    return `Expectation chain broke at step ${brokenStepIndex + 1}/${
      chain.length
    }: ${chainTypes}. Successfully completed ${fulfilledSteps} step(s) before ${brokenType} failed.`;
  }

  /**
   * Extract URL path from full URL
   * @private
   */
  _getUrlPath(url) {
    if (!url) return '';
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
}

export default ExpectationChainDetector;
