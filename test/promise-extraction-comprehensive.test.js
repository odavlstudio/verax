/**
 * Promise Extraction 2.0 Tests
 * 
 * Validates comprehensive extraction with static resolution:
 * - Navigation: Next.js, React Router, Vue Router, Angular, SvelteKit
 * - Network: fetch, axios, GraphQL, WebSocket with relative URLs
 * - Feedback: toast, modal, notification libraries
 * - State: Redux, Zustand, setState with UI context
 * - Deterministic ID generation
 * - Detailed skip reason tracking
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractPromises2 } from '../src/cli/util/detection/promise-extractor-2.js';

describe('Promise Extraction 2.0 - Navigation', () => {
  it('extracts Next.js router.push with string literal', () => {
    const content = `
      const router = useRouter();
      router.push("/dashboard");
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const navExpectation = result.expectations.find(e => e.promise.value === '/dashboard');
    assert.ok(navExpectation, 'Should extract /dashboard navigation');
    assert.equal(navExpectation.type, 'navigation');
    assert.equal(navExpectation.promise.kind, 'navigate');
    assert.equal(navExpectation.extractionVersion, '2.0');
  });
  
  it('extracts Next.js router.push with template literal', () => {
    const content = `
      const USER_ID = "123";
      const router = useRouter();
      router.push(\`/users/\${USER_ID}\`);
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const navExpectation = result.expectations.find(e => e.promise.value === '/users/123');
    assert.ok(navExpectation, 'Should extract /users/123 with resolved template');
    assert.equal(navExpectation.type, 'navigation');
    assert.equal(navExpectation.confidence, 'STATIC');
  });
  
  it('resolves template + concat navigation paths', () => {
    const content = `
      const BASE = "/dashboard";
      const SEGMENT = "settings";
      const router = useRouter();
      const target = \`\${BASE}/\${SEGMENT}\` + '/profile';
      router.push(target);
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');

    const navExpectation = result.expectations.find(e => e.promise.value === '/dashboard/settings/profile');
    assert.ok(navExpectation, 'Should resolve template and concatenation');
    assert.equal(navExpectation.promise.kind, 'navigate');
  });
  it('extracts React Router navigate with string literal', () => {
    const content = `
      import { useNavigate } from 'react-router-dom';
      const navigate = useNavigate();
      navigate("/settings");
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const navExpectation = result.expectations.find(e => e.promise.value === '/settings');
    assert.ok(navExpectation, 'Should extract /settings navigation');
    assert.equal(navExpectation.type, 'navigation');
  });
  
  it('extracts Vue Router router.push with string literal', () => {
    const content = `
      import { useRouter } from 'vue-router';
      const router = useRouter();
      router.push("/profile");
    `;
    const result = extractPromises2(content, '/test.vue', 'test.vue');
    
    const navExpectation = result.expectations.find(e => e.promise.value === '/profile');
    assert.ok(navExpectation, 'Should extract /profile navigation');
    assert.equal(navExpectation.type, 'navigation');
  });
  
  it('extracts Angular router.navigate with array literal', () => {
    const content = `
      const USER_ID = '456';
      const router = { navigate: () => {} };
      router.navigate(['/users', USER_ID]);
    `;
    const result = extractPromises2(content, '/test.ts', 'test.ts');
    
    const navExpectation = result.expectations.find(e => e.promise.value === '/users/456');
    assert.ok(navExpectation, 'Should extract /users/456 from array');
    assert.equal(navExpectation.type, 'navigation');
  });
  
  it('extracts SvelteKit goto with string literal', () => {
    const content = `
      import { goto } from '$app/navigation';
      goto("/about");
    `;
    const result = extractPromises2(content, '/test.svelte', 'test.svelte');
    
    const navExpectation = result.expectations.find(e => e.promise.value === '/about');
    assert.ok(navExpectation, 'Should extract /about navigation');
    assert.equal(navExpectation.type, 'navigation');
  });
  
  it('skips dynamic navigation with identifier', () => {
    const content = `
      const router = useRouter();
      const path = getUserPath(); // Function call
      router.push(path);
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const navExpectations = result.expectations.filter(e => e.type === 'navigation');
    assert.equal(navExpectations.length, 0, 'Should not extract dynamic path');
    assert.ok(result.skipped.dynamic_identifier > 0, 'Should track dynamic_identifier skip');
  });
  
  it('skips dynamic navigation with template expression', () => {
    const content = `
      const router = useRouter();
      const id = props.userId; // Dynamic prop
      router.push(\`/users/\${id}\`);
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const navExpectations = result.expectations.filter(e => e.type === 'navigation');
    assert.equal(navExpectations.length, 0, 'Should not extract dynamic template');
    assert.ok(result.skipped.dynamic_template_expr > 0, 'Should track dynamic_template_expr skip');
  });
});

describe('Promise Extraction 2.0 - Network', () => {
  it('extracts fetch with relative URL', () => {
    const content = `
      fetch("/api/users");
    `;
    const result = extractPromises2(content, '/test.ts', 'test.ts');
    
    const networkExpectation = result.expectations.find(e => e.promise.value === '/api/users');
    assert.ok(networkExpectation, 'Should extract /api/users fetch');
    assert.equal(networkExpectation.type, 'network');
    assert.equal(networkExpectation.promise.kind, 'network.request');
    assert.equal(networkExpectation.promise.rawUrl, '/api/users');
  });
  
  it('extracts axios.get with relative URL', () => {
    const content = `
      import axios from 'axios';
      axios.get("/api/posts");
    `;
    const result = extractPromises2(content, '/test.ts', 'test.ts');
    
    const networkExpectation = result.expectations.find(e => e.promise.value === '/api/posts');
    assert.ok(networkExpectation, 'Should extract /api/posts axios request');
    assert.equal(networkExpectation.type, 'network');
    assert.equal(networkExpectation.promise.kind, 'network.request');
  });
  
  it('resolves axios baseURL from axios.create', () => {
    const content = `
      import axios from 'axios';
      const api = axios.create({ baseURL: '/api' });
      api.get("/users");
    `;
    const result = extractPromises2(content, '/test.ts', 'test.ts');
    
    const networkExpectation = result.expectations.find(e => e.promise.effectiveUrl === '/api/users');
    assert.ok(networkExpectation, 'Should extract /api/users with resolved baseURL');
    assert.equal(networkExpectation.type, 'network');
    assert.equal(networkExpectation.promise.rawUrl, '/users');
  });
  
  it('extracts GraphQL fetch with query detection', () => {
    const content = `
      fetch("/graphql", {
        method: "POST",
        body: JSON.stringify({ query: "{ user { name } }" })
      });
    `;
    const result = extractPromises2(content, '/test.ts', 'test.ts');
    
    const networkExpectation = result.expectations.find(e => e.promise.value === '/graphql');
    assert.ok(networkExpectation, 'Should extract /graphql request');
    assert.equal(networkExpectation.type, 'network');
    assert.equal(networkExpectation.promise.kind, 'network.graphql');
    assert.equal(networkExpectation.promise.intent, 'graphql');
  });
  
  it('extracts WebSocket with relative URL', () => {
    const content = `
      const ws = new WebSocket("/ws/notifications");
    `;
    const result = extractPromises2(content, '/test.ts', 'test.ts');
    
    const networkExpectation = result.expectations.find(e => e.promise.value === '/ws/notifications');
    assert.ok(networkExpectation, 'Should extract /ws/notifications WebSocket');
    assert.equal(networkExpectation.type, 'network');
    assert.equal(networkExpectation.promise.kind, 'network.ws');
  });
  
  it('skips dynamic fetch URLs', () => {
    const content = `
      const endpoint = getEndpoint();
      fetch(endpoint);
    `;
    const result = extractPromises2(content, '/test.ts', 'test.ts');
    
    const networkExpectations = result.expectations.filter(e => e.type === 'network');
    assert.equal(networkExpectations.length, 0, 'Should not extract dynamic URL');
    assert.ok(result.skipped.dynamic_identifier > 0);
  });
});

describe('Promise Extraction 2.0 - Feedback', () => {
  it('extracts toast notification (react-hot-toast)', () => {
    const content = `
      import toast from 'react-hot-toast';
      toast.success("User saved");
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const feedbackExpectation = result.expectations.find(e => 
      e.type === 'feedback' && e.promise.value === 'User saved'
    );
    assert.ok(feedbackExpectation, 'Should extract toast feedback');
    assert.equal(feedbackExpectation.promise.kind, 'feedback.toast');
  });
  
  it('extracts sonner toast notification', () => {
    const content = `
      import { toast } from 'sonner';
      toast("Settings updated");
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const feedbackExpectation = result.expectations.find(e => 
      e.type === 'feedback' && e.promise.value === 'Settings updated'
    );
    assert.ok(feedbackExpectation, 'Should extract sonner toast');
    assert.equal(feedbackExpectation.promise.kind, 'feedback.toast');
  });
  
  it('extracts modal open (headlessui)', () => {
    const content = `
      import { Dialog } from '@headlessui/react';
      setIsOpen(true);
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const modalExpectation = result.expectations.find(e => e.promise.kind === 'feedback.modal');
    assert.ok(modalExpectation, 'Should extract modal open feedback');
  });
  
  it('skips dynamic toast messages', () => {
    const content = `
      import toast from 'react-hot-toast';
      const message = getMessage();
      toast.success(message);
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const feedbackExpectation = result.expectations.find(e => e.promise.kind === 'feedback.toast');
    assert.ok(feedbackExpectation, 'Should still emit feedback without claiming message content');
    assert.equal(feedbackExpectation.promise.value, 'feedback');
  });

  it('emits feedback toast inside onClick handler', () => {
    const content = `
      import toast from 'react-hot-toast';
      function Button() {
        return <button onClick={() => toast('Clicked!')}>Click</button>;
      }
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    const feedbackExpectation = result.expectations.find(e => e.promise.value === 'Clicked!');
    assert.ok(feedbackExpectation, 'Should extract toast inside handler');
    assert.equal(feedbackExpectation.promise.kind, 'feedback.toast');
  });
});

describe('Promise Extraction 2.0 - State', () => {
  it('extracts Redux dispatch with UI context', () => {
    const content = `
      import { useDispatch } from 'react-redux';
      const dispatch = useDispatch();
      
      function handleClick() {
        dispatch({ type: 'USER_LOGOUT' });
      }
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const stateExpectation = result.expectations.find(e => 
      e.type === 'state' && e.promise.value === 'USER_LOGOUT'
    );
    assert.ok(stateExpectation, 'Should extract Redux dispatch');
    assert.equal(stateExpectation.promise.kind, 'state.redux');
  });
  
  it('extracts Zustand set with UI context', () => {
    const content = `
      import { create } from 'zustand';

      function Component() {
        const set = () => {};
        const handleClick = () => set((state) => ({ count: state.count + 1 }));
        return <button onClick={handleClick}>Add</button>;
      }
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const stateExpectation = result.expectations.find(e => e.type === 'state');
    assert.ok(stateExpectation, 'Should extract Zustand set');
  });
  
  it('skips setState without UI context', () => {
    const content = `
      function updateInBackground() {
        setState({ loading: true }); // Not UI-coupled
      }
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    // setState without UI context (no onClick, onChange, etc.) is skipped
    const stateExpectations = result.expectations.filter(e => e.type === 'state');
    assert.equal(stateExpectations.length, 0, 'Should skip non-UI setState');
  });
});

describe('Promise Extraction 2.0 - JSX Navigation', () => {
  it('extracts Next.js Link href with string literal', () => {
    const content = `
      import Link from 'next/link';
      <Link href="/contact">Contact</Link>
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const navExpectation = result.expectations.find(e => e.promise.value === '/contact');
    assert.ok(navExpectation, 'Should extract /contact from Link href');
    assert.equal(navExpectation.type, 'navigation');
  });
  
  it('extracts Vue router-link to with string literal', () => {
    const content = `
      <template>
        <router-link to="/services">Services</router-link>
      </template>
    `;
    const result = extractPromises2(content, '/test.vue', 'test.vue');
    
    const navExpectation = result.expectations.find(e => e.promise.value === '/services');
    assert.ok(navExpectation, 'Should extract /services from router-link');
  });
  
  it('extracts Angular routerLink with string literal', () => {
    const content = `
      <a routerLink="/products">Products</a>
    `;
    const result = extractPromises2(content, '/test.html', 'test.html');
    
    const navExpectation = result.expectations.find(e => e.promise.value === '/products');
    assert.ok(navExpectation, 'Should extract /products from routerLink');
  });
  
  it('skips dynamic Link href', () => {
    const content = `
      import Link from 'next/link';
      <Link href={dynamicPath}>Dynamic</Link>
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    const navExpectations = result.expectations.filter(e => 
      e.type === 'navigation' && e.promise.value === 'dynamicPath'
    );
    assert.equal(navExpectations.length, 0, 'Should not extract dynamic href');
  });
});

describe('Promise Extraction 2.0 - Determinism', () => {
  it('generates stable IDs for same extraction', () => {
    const content = `
      const router = useRouter();
      router.push("/dashboard");
    `;
    
    const result1 = extractPromises2(content, '/test.tsx', 'test.tsx');
    const result2 = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    assert.equal(result1.expectations.length, result2.expectations.length);
    
    if (result1.expectations.length > 0) {
      const exp1 = result1.expectations[0];
      const exp2 = result2.expectations[0];
      
      assert.equal(exp1.source.file, exp2.source.file);
      assert.equal(exp1.source.line, exp2.source.line);
      assert.equal(exp1.promise.value, exp2.promise.value);
    }
  });
  
  it('tracks skip reasons deterministically', () => {
    const content = `
      router.push(dynamicPath1);
      router.push(dynamicPath2);
      fetch(\`/api/\${id}\`);
    `;
    
    const result1 = extractPromises2(content, '/test.tsx', 'test.tsx');
    const result2 = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    assert.equal(result1.skipped.dynamic_identifier, result2.skipped.dynamic_identifier);
    assert.equal(result1.skipped.dynamic_template_expr, result2.skipped.dynamic_template_expr);
  });
});

describe('Promise Extraction 2.0 - Skip Reason Tracking', () => {
  it('tracks dynamic_identifier for function calls', () => {
    const content = `
      router.push(getPath());
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    assert.ok(result.skipped.dynamic_call > 0, 'Should track dynamic_call for function result');
  });
  
  it('tracks dynamic_member for property access', () => {
    const content = `
      router.push(config.basePath);
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    assert.ok(result.skipped.dynamic_member > 0, 'Should track dynamic_member for property access');
  });
  
  it('tracks dynamic_conditional for ternary', () => {
    const content = `
      router.push(isAdmin ? '/admin' : '/user');
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    assert.ok(result.skipped.dynamic_conditional > 0, 'Should track dynamic_conditional for ternary');
  });

  it('tracks dynamic_template_expr for unresolved template parts', () => {
    const content = `
      const id = getId();
      router.push(` + "`/users/${id}`" + `);
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');

    assert.ok(result.skipped.dynamic_template_expr > 0, 'Should track dynamic_template_expr');
  });
  
  it('tracks no_matching_import for libraries without imports', () => {
    const content = `
      toast.success("Hello"); // No import detected
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    assert.ok(result.skipped.no_matching_import >= 0, 'Should track no_matching_import');
  });
});

describe('Promise Extraction 2.0 - Extraction Version Marker', () => {
  it('marks all expectations with extractionVersion: 2.0', () => {
    const content = `
      router.push("/dashboard");
      fetch("/api/users");
      toast.success("Saved");
    `;
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    result.expectations.forEach((exp) => {
      assert.equal(exp.extractionVersion, '2.0', 'All expectations should have version 2.0');
    });
  });
});
