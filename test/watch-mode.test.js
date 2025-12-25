const assert = require('assert');
const { startWatchMode } = require('../src/guardian/watch-runner');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRunStub(exitCodes) {
  let call = 0;
  return async () => {
    const idx = Math.min(call, exitCodes.length - 1);
    const result = { exitCode: exitCodes[idx], flowResults: [], diffResult: null, baselineCreated: false };
    call += 1;
    return result;
  };
}

function makeAsyncRunStub(exitCodes, resolveHooks) {
  let call = 0;
  return () => {
    const idx = Math.min(call, exitCodes.length - 1);
    const result = { exitCode: exitCodes[idx], flowResults: [], diffResult: null, baselineCreated: false };
    call += 1;
    return new Promise(res => {
      resolveHooks.push(() => res(result));
    });
  };
}

(async () => {
  console.log('\n🧪 Watch Mode Tests');

  // Scenario A: watch ignored in CI
  {
    const logs = [];
    const runReality = makeRunStub([0]);
    const res = await startWatchMode(
      { watch: true },
      { isCi: true, runReality, log: (l) => logs.push(l), warn: (l) => logs.push(l) }
    );
    assert.strictEqual(res.watchStarted, false, 'Watch should not start in CI');
    assert.strictEqual(res.exitCode, 0, 'Single run should execute in CI');
    assert(logs.some(l => String(l).includes('ignored')), 'Warning should be printed for CI');
  }

  // Scenario B: single file change triggers rerun after debounce
  {
    const logs = [];
    const runRealityCalls = [];
    const runReality = async () => {
      const callIndex = runRealityCalls.length;
      runRealityCalls.push(true);
      return { exitCode: 0, flowResults: [], diffResult: null, baselineCreated: false, callIndex };
    };
    const controller = await startWatchMode(
      { watch: true },
      {
        runReality,
        debounceMs: 10,
        log: (l) => logs.push(l),
        warn: () => {},
        watchFactory: () => ({ close() {} })
      }
    );
    await wait(20); // initial run
    controller.simulateChange('config/guardian.config.json');
    await wait(30);
    assert.strictEqual(runRealityCalls.length >= 2, true, 'Rerun should occur after change');
    controller.stop();
  }

  // Scenario C: multiple rapid changes trigger one rerun
  {
    const logs = [];
    const resolveHooks = [];
    const runReality = makeAsyncRunStub([0, 0], resolveHooks);
    const controllerPromise = startWatchMode(
      { watch: true },
      {
        runReality,
        debounceMs: 10,
        log: (l) => logs.push(l),
        warn: () => {},
        watchFactory: () => ({ close() {} })
      }
    );
    // Wait a tick to ensure initial run scheduled
    await wait(5);
    // Trigger changes while run in progress
    const controller = await controllerPromise;
    controller.simulateChange('policies/start.json');
    controller.simulateChange('policies/start2.json');
    // Finish first run
    resolveHooks.shift()();
    await wait(30);
    // Finish second run if scheduled
    if (resolveHooks.length) resolveHooks.shift()();
    await wait(10);
    assert.strictEqual(resolveHooks.length, 0, 'Only one rerun should be queued');
    controller.stop();
  }

  // Scenario D: exit code surfaces and final exit code equals last run
  {
    const logs = [];
    const runReality = makeRunStub([1, 2]);
    const controller = await startWatchMode(
      { watch: true },
      {
        runReality,
        debounceMs: 5,
        log: (l) => logs.push(l),
        warn: () => {},
        watchFactory: () => ({ close() {} })
      }
    );
    await wait(10);
    controller.simulateChange('flows/example.json');
    await wait(20);
    const exitCode = controller.stop();
    assert(logs.some(l => String(l).includes('exit=1')), 'First run exit code should be logged');
    assert(logs.some(l => String(l).includes('exit=2')), 'Second run exit code should be logged');
    assert.strictEqual(exitCode, 2, 'Last exit code should be returned on stop');
  }

  console.log('✅ Watch mode tests passed');
})();
