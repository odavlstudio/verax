import { test } from 'node:test';
import assert from 'node:assert';
import { extractASTContracts, contractsToExpectations } from '../src/verax/learn/ast-contract-extractor.js';
import { ExpectationProof } from '../src/verax/shared/expectation-proof.js';
import { resolve } from 'path';

test('extractASTContracts finds React Router Link with static to', async () => {
  const projectDir = resolve(process.cwd(), 'test/fixtures/react-router-app');
  const contracts = await extractASTContracts(projectDir);
  
  // Should find Link to="/about" and Link to="/pricing"
  assert.ok(contracts.length >= 2, `Expected at least 2 contracts, got ${contracts.length}`);
  
  const aboutContract = contracts.find(c => c.targetPath === '/about');
  assert.ok(aboutContract, 'Should find contract for /about');
  assert.strictEqual(aboutContract.proof, ExpectationProof.PROVEN_EXPECTATION);
  assert.strictEqual(aboutContract.element, 'Link');
  assert.strictEqual(aboutContract.attribute, 'to');
  
  const pricingContract = contracts.find(c => c.targetPath === '/pricing');
  assert.ok(pricingContract, 'Should find contract for /pricing');
  assert.strictEqual(pricingContract.proof, ExpectationProof.PROVEN_EXPECTATION);
});

test('extractASTContracts finds Next.js Link with static href', async () => {
  const projectDir = resolve(process.cwd(), 'test/fixtures/nextjs-app');
  const contracts = await extractASTContracts(projectDir);
  
  // Should find Link href="/pricing", Link href="/contact", a href="/about"
  assert.ok(contracts.length >= 3, `Expected at least 3 contracts, got ${contracts.length}`);
  
  const pricingContract = contracts.find(c => c.targetPath === '/pricing');
  assert.ok(pricingContract, 'Should find contract for /pricing');
  assert.strictEqual(pricingContract.proof, ExpectationProof.PROVEN_EXPECTATION);
  assert.strictEqual(pricingContract.element, 'Link');
  assert.strictEqual(pricingContract.attribute, 'href');
  
  const aboutContract = contracts.find(c => c.targetPath === '/about');
  assert.ok(aboutContract, 'Should find contract for /about from plain <a>');
  assert.strictEqual(aboutContract.element, 'a');
  assert.strictEqual(aboutContract.attribute, 'href');
});

test('extractASTContracts ignores dynamic href values', async () => {
  const { writeFileSync, mkdirSync, rmSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  
  const tempDir = join(tmpdir(), `verax-ast-test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  
  try {
    // Create file with dynamic href
    writeFileSync(join(tempDir, 'Dynamic.jsx'), `
      import { Link } from 'react-router-dom';
      
      function Dynamic({ id, path }) {
        return (
          <div>
            <Link to={\`/user/\${id}\`}>Dynamic User</Link>
            <Link to={path}>Variable Path</Link>
            <Link to="/static">Static Path</Link>
          </div>
        );
      }
    `);
    
    const contracts = await extractASTContracts(tempDir);
    
    // Should only find the static one
    assert.strictEqual(contracts.length, 1);
    assert.strictEqual(contracts[0].targetPath, '/static');
    assert.strictEqual(contracts[0].proof, ExpectationProof.PROVEN_EXPECTATION);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('contractsToExpectations converts contracts to manifest format', async () => {
  const contracts = [
    {
      kind: 'NAVIGATION',
      targetPath: '/about',
      sourceFile: 'App.js',
      element: 'Link',
      attribute: 'to',
      proof: ExpectationProof.PROVEN_EXPECTATION,
      line: 10
    },
    {
      kind: 'NAVIGATION',
      targetPath: '/pricing',
      sourceFile: 'App.js',
      element: 'Link',
      attribute: 'href',
      proof: ExpectationProof.PROVEN_EXPECTATION,
      line: 15
    }
  ];
  
  const expectations = contractsToExpectations(contracts, 'react_spa');
  
  assert.strictEqual(expectations.length, 2);
  assert.strictEqual(expectations[0].type, 'spa_navigation');
  assert.strictEqual(expectations[0].targetPath, '/about');
  assert.strictEqual(expectations[0].matchAttribute, 'to');
  assert.strictEqual(expectations[0].proof, ExpectationProof.PROVEN_EXPECTATION);
});

test('contractsToExpectations excludes imperativeOnly contracts', async () => {
  const contracts = [
    {
      kind: 'NAVIGATION',
      targetPath: '/about',
      sourceFile: 'App.js',
      element: 'Link',
      attribute: 'to',
      proof: ExpectationProof.PROVEN_EXPECTATION,
      line: 10
    },
    {
      kind: 'NAVIGATION',
      targetPath: '/settings',
      sourceFile: 'App.js',
      element: 'navigate',
      attribute: null,
      proof: ExpectationProof.PROVEN_EXPECTATION,
      line: 20,
      imperativeOnly: true
    }
  ];
  
  const expectations = contractsToExpectations(contracts, 'react_spa');
  
  // Should only include the Link, not the navigate call
  assert.strictEqual(expectations.length, 1);
  assert.strictEqual(expectations[0].targetPath, '/about');
});

test('extractASTContracts handles parse errors gracefully', async () => {
  const { writeFileSync, mkdirSync, rmSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  
  const tempDir = join(tmpdir(), `verax-ast-error-test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  
  try {
    // Create file with syntax error
    writeFileSync(join(tempDir, 'Invalid.jsx'), `
      import { Link } from 'react-router-dom';
      
      function Invalid() {
        return <Link to="/valid">Valid</Link
        // Missing closing tag
      }
    `);
    
    // Create valid file
    writeFileSync(join(tempDir, 'Valid.jsx'), `
      import { Link } from 'react-router-dom';
      
      function Valid() {
        return <Link to="/valid">Valid</Link>;
      }
    `);
    
    const contracts = await extractASTContracts(tempDir);
    
    // Should skip the invalid file and process the valid one
    assert.ok(contracts.length >= 1);
    const validContract = contracts.find(c => c.targetPath === '/valid');
    assert.ok(validContract, 'Should find contract from valid file');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
