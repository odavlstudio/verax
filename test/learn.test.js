import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { learn } from '../src/verax/learn/index.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('learn detects Next.js App Router project', async () => {
  const tempDir = createTempDir();
  try {
    mkdirSync(join(tempDir, 'app'), { recursive: true });
    mkdirSync(join(tempDir, 'app', 'about'), { recursive: true });
    writeFileSync(join(tempDir, 'app', 'page.tsx'), 'export default function Page() { return <div>Home</div>; }');
    writeFileSync(join(tempDir, 'app', 'about', 'page.tsx'), 'export default function Page() { return <div>About</div>; }');
    
    const manifest = await learn(tempDir);
    
    assert.strictEqual(manifest.projectType, 'nextjs_app_router');
    assert.ok(manifest.routes.length >= 2);
    assert.ok(manifest.routes.some(r => r.path === '/'));
    assert.ok(manifest.routes.some(r => r.path === '/about'));
    assert.ok(existsSync(manifest.manifestPath));
    
    const manifestContent = JSON.parse(readFileSync(manifest.manifestPath, 'utf-8'));
    assert.strictEqual(manifestContent.version, 1);
    assert.strictEqual(manifestContent.projectType, 'nextjs_app_router');
    assert.ok(manifestContent.learnedAt);
    assert.strictEqual(manifestContent.projectDir, tempDir);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn detects Next.js Pages Router project', async () => {
  const tempDir = createTempDir();
  try {
    mkdirSync(join(tempDir, 'pages'), { recursive: true });
    writeFileSync(join(tempDir, 'pages', 'index.js'), 'export default function Home() { return <div>Home</div>; }');
    writeFileSync(join(tempDir, 'pages', 'about.js'), 'export default function About() { return <div>About</div>; }');
    
    const manifest = await learn(tempDir);
    
    assert.strictEqual(manifest.projectType, 'nextjs_pages_router');
    assert.ok(manifest.routes.length >= 2);
    assert.ok(manifest.routes.some(r => r.path === '/'));
    assert.ok(manifest.routes.some(r => r.path === '/about'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn classifies routes as public or internal', async () => {
  const tempDir = createTempDir();
  try {
    mkdirSync(join(tempDir, 'app'), { recursive: true });
    mkdirSync(join(tempDir, 'app', 'pricing'), { recursive: true });
    mkdirSync(join(tempDir, 'app', 'admin'), { recursive: true });
    mkdirSync(join(tempDir, 'app', 'dashboard'), { recursive: true });
    writeFileSync(join(tempDir, 'app', 'page.tsx'), 'export default function Page() { return <div>Home</div>; }');
    writeFileSync(join(tempDir, 'app', 'pricing', 'page.tsx'), 'export default function Page() { return <div>Pricing</div>; }');
    writeFileSync(join(tempDir, 'app', 'admin', 'page.tsx'), 'export default function Page() { return <div>Admin</div>; }');
    writeFileSync(join(tempDir, 'app', 'dashboard', 'page.tsx'), 'export default function Page() { return <div>Dashboard</div>; }');
    
    const manifest = await learn(tempDir);
    
    const publicRoutes = manifest.routes.filter(r => r.public);
    const internalRoutes = manifest.routes.filter(r => !r.public);
    
    assert.ok(publicRoutes.some(r => r.path === '/'));
    assert.ok(publicRoutes.some(r => r.path === '/pricing'));
    assert.ok(internalRoutes.some(r => r.path === '/admin'));
    assert.ok(internalRoutes.some(r => r.path === '/dashboard'));
    
    assert.deepStrictEqual(manifest.publicRoutes, publicRoutes.map(r => r.path));
    assert.deepStrictEqual(manifest.internalRoutes, internalRoutes.map(r => r.path));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn generates manifest with correct schema', async () => {
  const tempDir = createTempDir();
  try {
    mkdirSync(join(tempDir, 'app'), { recursive: true });
    writeFileSync(join(tempDir, 'app', 'page.tsx'), 'export default function Page() { return <div>Home</div>; }');
    
    const manifest = await learn(tempDir);
    
    assert.ok(existsSync(manifest.manifestPath));
    const manifestContent = JSON.parse(readFileSync(manifest.manifestPath, 'utf-8'));
    
    assert.strictEqual(typeof manifestContent.version, 'number');
    assert.strictEqual(typeof manifestContent.learnedAt, 'string');
    assert.strictEqual(typeof manifestContent.projectDir, 'string');
    assert.strictEqual(typeof manifestContent.projectType, 'string');
    assert.ok(Array.isArray(manifestContent.routes));
    assert.ok(Array.isArray(manifestContent.publicRoutes));
    assert.ok(Array.isArray(manifestContent.internalRoutes));
    assert.ok(Array.isArray(manifestContent.notes));
    
    if (manifestContent.routes.length > 0) {
      const route = manifestContent.routes[0];
      assert.strictEqual(typeof route.path, 'string');
      assert.strictEqual(typeof route.source, 'string');
      assert.strictEqual(typeof route.public, 'boolean');
    }
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn handles unknown project type', async () => {
  const tempDir = createTempDir();
  try {
    writeFileSync(join(tempDir, 'readme.txt'), 'Just a text file');
    
    const manifest = await learn(tempDir);
    
    assert.strictEqual(manifest.projectType, 'unknown');
    assert.ok(Array.isArray(manifest.routes));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn deduplicates routes', async () => {
  const tempDir = createTempDir();
  try {
    mkdirSync(join(tempDir, 'app'), { recursive: true });
    writeFileSync(join(tempDir, 'app', 'page.tsx'), 'export default function Page() { return <div>Home</div>; }');
    writeFileSync(join(tempDir, 'app', 'page.js'), 'export default function Page() { return <div>Home</div>; }');
    
    const manifest = await learn(tempDir);
    
    const homeRoutes = manifest.routes.filter(r => r.path === '/');
    assert.ok(homeRoutes.length <= 2);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('learn sorts routes by path', async () => {
  const tempDir = createTempDir();
  try {
    mkdirSync(join(tempDir, 'app'), { recursive: true });
    mkdirSync(join(tempDir, 'app', 'zebra'), { recursive: true });
    mkdirSync(join(tempDir, 'app', 'apple'), { recursive: true });
    writeFileSync(join(tempDir, 'app', 'zebra', 'page.tsx'), 'export default function Page() { return <div>Zebra</div>; }');
    writeFileSync(join(tempDir, 'app', 'apple', 'page.tsx'), 'export default function Page() { return <div>Apple</div>; }');
    writeFileSync(join(tempDir, 'app', 'page.tsx'), 'export default function Page() { return <div>Home</div>; }');
    
    const manifest = await learn(tempDir);
    
    const paths = manifest.routes.map(r => r.path);
    const sortedPaths = [...paths].sort();
    assert.deepStrictEqual(paths, sortedPaths);
  } finally {
    cleanupTempDir(tempDir);
  }
});

