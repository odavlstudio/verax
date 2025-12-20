import { ErrorSignature } from '../types';
import { cannotReadNullUndefined } from './runtime/cannot-read-null-undefined';
import { isNotAFunction } from './runtime/is-not-a-function';
import { isNotIterable } from './runtime/is-not-iterable';
import { unexpectedTokenRuntime } from './runtime/unexpected-token';
import { maximumCallStack } from './runtime/maximum-call-stack';

import { moduleNotFoundBuild } from './build/module-not-found';
import { cannotFindModuleLiteral } from './build/cannot-find-module-literal';
import { ts2307CannotFindModule } from './build/ts2307';
import { failedToCompileLoader } from './build/failed-to-compile';

import { invalidHookCall } from './react/invalid-hook-call';
import { tooManyReRenders } from './react/too-many-rerenders';
import { objectNotValidChild } from './react/object-not-valid-child';
import { cannotUpdateDuringRender } from './react/cannot-update-during-render';
import { useEffectDepsIssue } from './react/useeffect-deps';

import { processEnvMissing } from './node/process-env-missing';
import { eaddrinuse } from './node/eaddrinuse';
import { importOutsideModule } from './node/import-outside-module';
import { requireNotDefined } from './node/require-not-defined';

export const signatures: ErrorSignature[] = [
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
