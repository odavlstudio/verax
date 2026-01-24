/**
 * Incremental Skip Phantom Trace Builder
 * 
 * Extracted from observe/index.js (STAGE D2.4)
 * 
 * Builds the minimal phantom trace object that represents a skipped
 * interaction in incremental mode. The phantom trace preserves interaction
 * metadata but has no execution result (before/after URLs are identical).
 * 
 * Preserves 100% of original behavior:
 * - Same 5 top-level properties
 * - Same nested object shapes
 * - incremental flag always true
 * - resultType always 'INCREMENTAL_SKIP'
 */

/**
 * Build a phantom trace for an incremental skip.
 * 
 * When an interaction is skipped in incremental mode (because it was
 * unchanged from the previous run), a phantom trace is created to:
 * 1. Preserve the interaction metadata for the observation record
 * 2. Mark the trace as incremental (via incremental: true) for filtering
 * 3. Enable transparent output (trace appears in JSON but marked as skipped)
 * 
 * @param {Object} params - Function parameters
 * @param {Object} params.interaction - The interaction that was skipped
 * @param {string} params.interaction.type - Interaction type (e.g., 'click')
 * @param {string} params.interaction.selector - CSS selector
 * @param {string} params.interaction.label - Human-readable label
 * @param {string} params.currentUrl - Current page URL (used for before/after)
 * @returns {Object} Phantom trace object with incremental flag set
 */
export function buildIncrementalPhantomTrace({ interaction, currentUrl }) {
  return {
    interaction: {
      type: interaction.type,
      selector: interaction.selector,
      label: interaction.label
    },
    before: { url: currentUrl },
    after: { url: currentUrl },
    incremental: true,
    resultType: 'INCREMENTAL_SKIP'
  };
}



