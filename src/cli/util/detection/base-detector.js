export class BaseDetector {
  constructor(meta = {}) {
    this.name = meta.name || 'detector';
    this.framework = meta.framework || 'generic';
    this.type = meta.type || 'generic';
  }

  detect(..._args) {
    throw new Error('detect(...args) must be implemented by detector subclasses');
  }

  run(...args) {
    return this.detect(...args);
  }
}

export default BaseDetector;








