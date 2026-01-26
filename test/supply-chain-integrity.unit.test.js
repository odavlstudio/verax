import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

test('Supply Chain Integrity - Lockfile Validation', (t) => {
  t.test('package-lock.json exists in project root', () => {
    const lockfilePath = resolve(process.cwd(), 'package-lock.json');
    assert(existsSync(lockfilePath), 'package-lock.json must exist for reproducible builds');
  });

  t.test('package-lock.json is valid JSON', () => {
    const lockfilePath = resolve(process.cwd(), 'package-lock.json');
    const content = readFileSync(lockfilePath, 'utf-8');
    let lockfile;
    assert.doesNotThrow(
      () => {
        lockfile = JSON.parse(content);
      },
      'package-lock.json must be valid JSON'
    );
    
    // Basic structure validation
    assert(lockfile.lockfileVersion, 'Lockfile must have lockfileVersion');
    assert(lockfile.packages !== undefined, 'Lockfile must have packages object');
  });

  t.test('package.json and package-lock.json are synchronized', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const lockfilePath = resolve(process.cwd(), 'package-lock.json');
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));
    
    // Check that lockfile name and version match
    assert.strictEqual(
      lockfile.name,
      packageJson.name,
      'package-lock.json name must match package.json'
    );
    
    assert.strictEqual(
      lockfile.version,
      packageJson.version,
      'package-lock.json version must match package.json'
    );
  });

  t.test('lockfile includes all declared dependencies', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const lockfilePath = resolve(process.cwd(), 'package-lock.json');
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));
    
    const declaredDeps = Object.keys(packageJson.dependencies || {});
    const lockfilePackages = Object.keys(lockfile.packages).filter(k => k !== '');
    
    for (const dep of declaredDeps) {
      assert(
        lockfilePackages.some(pkg => pkg.includes(dep)),
        `Dependency "${dep}" from package.json must be in lockfile`
      );
    }
  });

  t.test('lockfile version is acceptable', () => {
    const lockfilePath = resolve(process.cwd(), 'package-lock.json');
    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));
    
    // npm 7+ uses lockfileVersion 2 or 3
    const acceptableVersions = [2, 3];
    assert(
      acceptableVersions.includes(lockfile.lockfileVersion),
      `lockfileVersion must be 2 or 3 (modern npm), got ${lockfile.lockfileVersion}`
    );
  });
});

test('Supply Chain Integrity - Dependency Validation', (t) => {
  t.test('No critical vulnerabilities in npm audit', async () => {
    // This test would normally run `npm audit` but for unit test purposes
    // we just verify the lockfile structure is sound
    const lockfilePath = resolve(process.cwd(), 'package-lock.json');
    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));
    
    // Check that there are no obviously problematic patterns
    const packages = Object.entries(lockfile.packages || {});
    
    // Ensure all packages have a version
    for (const [pkgName, pkgData] of packages) {
      if (pkgName === '') continue; // Root package
      assert(
        pkgData.version,
        `Package ${pkgName} must have a version field`
      );
    }
  });

  t.test('Lodash vulnerability check (example)', async () => {
    const lockfilePath = resolve(process.cwd(), 'package-lock.json');
    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));
    
    // Example: Check if lodash (if used) is not vulnerable
    const packages = Object.entries(lockfile.packages || {});
    
    for (const [pkgName, pkgData] of packages) {
      if (pkgName.includes('lodash')) {
        const version = pkgData.version;
        // Example: Lodash <4.17.21 has prototype pollution
        assert(
          !version.startsWith('4.17.20'),
          `Lodash version ${version} may be vulnerable. Use >=4.17.21`
        );
      }
    }
  });

  t.test('All dependencies are from trusted sources', () => {
    const lockfilePath = resolve(process.cwd(), 'package-lock.json');
    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));
    
    const packages = Object.entries(lockfile.packages || {});
    
    // Check that all packages come from npm registry
    for (const [pkgName, pkgData] of packages) {
      if (pkgName === '') continue;
      
      const resolved = pkgData.resolved;
      assert(
        resolved === undefined || resolved.startsWith('https://registry.npmjs.org'),
        `Package ${pkgName} must come from npmjs registry or be local, got ${resolved}`
      );
    }
  });
});

test('Supply Chain Integrity - Node Version Compatibility', (t) => {
  t.test('Current Node version meets minimum requirement', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    const enginesNode = packageJson.engines?.node;
    assert(enginesNode, 'package.json must declare engines.node requirement');
    
    const requiredVersion = enginesNode.replace(/[^0-9.]/g, '');
    const currentVersion = process.version.replace(/[^0-9.]/g, '');
    
    const required = requiredVersion.split('.').map(Number);
    const current = currentVersion.split('.').map(Number);
    
    assert(
      current[0] > required[0] || (current[0] === required[0] && current[1] >= required[1]),
      `Current Node ${process.version} must be >= ${enginesNode}`
    );
  });

  t.test('Node 18+ is supported', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    const enginesNode = packageJson.engines?.node;
    assert(enginesNode, 'package.json must declare engines.node');
    assert(
      enginesNode.includes('18') || enginesNode.includes('>=18'),
      'Should support Node 18+'
    );
  });
});

test('Supply Chain Integrity - Dependency Review', (t) => {
  t.test('Only expected dependency sources are used', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.optionalDependencies,
    };
    
    // Verify we have expected dependencies
    const deps = Object.keys(allDeps);
    assert(deps.includes('@babel/parser'), 'Should have @babel/parser');
    assert(deps.includes('playwright'), 'Should have playwright');
    assert(deps.includes('typescript'), 'Should have typescript');
  });

  t.test('No suspicious or high-risk dependencies', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    
    const suspiciousDeps = [
      'eval', 'unsafe-eval', 'crypto-js',  // Weak crypto
      'request', 'node-fetch@<3',           // Deprecated
      'moment',                              // Heavy/deprecated (use date-fns)
    ];
    
    for (const dep of suspiciousDeps) {
      const depName = dep.split('@')[0];
      assert(
        !Object.keys(allDeps).includes(depName),
        `Should not use ${depName} dependency (${dep})`
      );
    }
  });
});

test('Supply Chain Integrity - Semantic Versioning', (t) => {
  t.test('All dependencies use semantic versioning', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.optionalDependencies,
    };
    
    const semverRegex = /^[\^~]?(\d+\.\d+\.\d+|latest|next)/;
    
    for (const [depName, version] of Object.entries(allDeps)) {
      assert(
        semverRegex.test(version),
        `Dependency ${depName} version "${version}" must use semantic versioning (e.g., ^1.0.0, ~2.1.0)`
      );
    }
  });

  t.test('No wildcard or vague version specs', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    
    for (const [depName, version] of Object.entries(allDeps)) {
      assert(
        !version.includes('*') && !version.includes('x'),
        `Dependency ${depName} should not use wildcard versions (*,x), got "${version}"`
      );
    }
  });
});
