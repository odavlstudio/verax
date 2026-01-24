/**
 * Type augmentation for undocumented Node.js internal APIs
 * Used for CI hang detection in fast-exit paths
 */

declare namespace NodeJS {
  interface Process {
    /**
     * Internal Node.js API: Returns array of active handles
     * Used for detecting resource leaks during fast CLI exits
     * @internal
     */
    _getActiveHandles(): any[];
  }
}
