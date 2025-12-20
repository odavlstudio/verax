const { cannotReadNullUndefined } = require('./runtime/cannot-read-null-undefined');
const { isNotAFunction } = require('./runtime/is-not-a-function');
const { isNotIterable } = require('./runtime/is-not-iterable');
const { unexpectedTokenRuntime } = require('./runtime/unexpected-token');
const { maximumCallStack } = require('./runtime/maximum-call-stack');

const { moduleNotFoundBuild } = require('./build/module-not-found');
const { cannotFindModuleLiteral } = require('./build/cannot-find-module-literal');
const { ts2307CannotFindModule } = require('./build/ts2307');
const { failedToCompileLoader } = require('./build/failed-to-compile');

const { invalidHookCall } = require('./react/invalid-hook-call');
const { tooManyReRenders } = require('./react/too-many-rerenders');
const { objectNotValidChild } = require('./react/object-not-valid-child');
const { cannotUpdateDuringRender } = require('./react/cannot-update-during-render');
const { useEffectDepsIssue } = require('./react/useeffect-deps');

const { processEnvMissing } = require('./node/process-env-missing');
const { eaddrinuse } = require('./node/eaddrinuse');
const { importOutsideModule } = require('./node/import-outside-module');
const { requireNotDefined } = require('./node/require-not-defined');

const signatures = [
  // Runtime
  cannotReadNullUndefined,
  isNotAFunction,
  isNotIterable,
  unexpectedTokenRuntime,
  maximumCallStack,
  // Build/Tooling
  moduleNotFoundBuild,
  cannotFindModuleLiteral,
  ts2307CannotFindModule,
  failedToCompileLoader,
  // React
  invalidHookCall,
  tooManyReRenders,
  objectNotValidChild,
  cannotUpdateDuringRender,
  useEffectDepsIssue,
  // Node
  processEnvMissing,
  eaddrinuse,
  importOutsideModule,
  requireNotDefined
];

module.exports = { signatures };
