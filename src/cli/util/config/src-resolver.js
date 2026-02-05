import { UsageError } from '../support/errors.js';
import { selectBestDefaultSrc } from './project-shape.js';

/**
 * Resolve default src when --src not provided.
 * Throws UsageError (exit 64) on ambiguity with actionable message.
 */
export function resolveDefaultSrc(cwd, srcArg) {
  if (srcArg && String(srcArg).trim().length > 0) {
    return srcArg;
  }

  const { selected, candidates, ambiguous } = selectBestDefaultSrc(cwd);
  if (ambiguous) {
    const list = candidates.map((c) => `  - ${c}`).join('\n');
    throw new UsageError(
      [
        'Ambiguous repository shape detected. Multiple source candidates found.',
        'Specify one explicitly using --src <path>. Candidates:',
        list,
      ].join('\n')
    );
  }
  return selected || '.';
}








