/**
 * Promise Extraction 2.0 - Comprehensive Integration Tests
 * 
 * Validates end-to-end extraction scenarios with realistic code examples
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractPromises2 } from '../src/cli/util/detection/promise-extractor-2.js';

describe('Promise Extraction 2.0 - Comprehensive Scenarios', () => {
  it('extracts all promise types from realistic Next.js component', () => {
    const content = `
      import { useRouter } from 'next/router';
      import Link from 'next/link';
      import toast from 'react-hot-toast';
      import axios from 'axios';
      
      const API_BASE = '/api';
      const USERS_PATH = '/users';
      
      export default function Dashboard() {
        const router = useRouter();
        
        const handleSave = async () => {
          try {
            const response = await axios.post(\`\${API_BASE}/save\`, data);
            toast.success('Saved successfully');
            router.push(\`\${USERS_PATH}/\${response.data.id}\`);
          } catch (error) {
            toast.error('Save failed');
          }
        };
        
        return (
          <div>
            <Link href="/dashboard/settings">Settings</Link>
            <button onClick={handleSave}>Save</button>
          </div>
        );
      }
    `;
    
    const result = extractPromises2(content, '/Dashboard.tsx', 'Dashboard.tsx');
    
    // Navigation promises
    const navExpectations = result.expectations.filter(e => e.type === 'navigation');
    assert.ok(navExpectations.length >= 1, 'Should extract Link href navigation');
    const settingsNav = navExpectations.find(e => e.promise.value === '/dashboard/settings');
    assert.ok(settingsNav, 'Should extract /dashboard/settings from Link');
    
    // Network promises
    const networkExpectations = result.expectations.filter(e => e.type === 'network');
    assert.ok(networkExpectations.length >= 1, 'Should extract axios network call');
    const apiCall = networkExpectations.find(e => e.promise.effectiveUrl === '/api/save');
    assert.ok(apiCall, 'Should extract /api/save with resolved template');
    assert.equal(apiCall.promise.method, 'POST', 'Should detect POST method');
    
    // Feedback promises
    const feedbackExpectations = result.expectations.filter(e => e.type === 'feedback');
    assert.ok(feedbackExpectations.length >= 2, 'Should extract both toast calls');
    const successToast = feedbackExpectations.find(e => e.promise.value === 'Saved successfully');
    assert.ok(successToast, 'Should extract success toast');
    assert.equal(successToast.promise.kind, 'feedback.toast');
  });
  
  it('extracts promises from Angular component with router.navigate', () => {
    const content = `
      const ADMIN_ROUTE = '/admin';
      const USER_ID = '123';
      
      class UserComponent {
        constructor(private router: Router) {}
        
        navigateToUser() {
          this.router.navigate([ADMIN_ROUTE, 'users', USER_ID]);
        }
      }
    `;
    
    const result = extractPromises2(content, '/user.component.ts', 'user.component.ts');
    
    const navExpectations = result.expectations.filter(e => e.type === 'navigation');
    assert.ok(navExpectations.length >= 1, 'Should extract router.navigate');
    const adminNav = navExpectations.find(e => e.promise.value === '/admin/users/123');
    assert.ok(adminNav, 'Should resolve array to path /admin/users/123');
  });
  
  it('extracts GraphQL network promise with query detection', () => {
    const content = `
      const GRAPHQL_ENDPOINT = '/graphql';
      
      async function fetchUser() {
        const query = "query { user { name email } }";
        const response = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          body: JSON.stringify({ query })
        });
        return response.json();
      }
    `;
    
    const result = extractPromises2(content, '/api.ts', 'api.ts');
    
    const networkExpectations = result.expectations.filter(e => e.type === 'network');
    assert.ok(networkExpectations.length >= 1, 'Should extract GraphQL fetch');
    const graphqlCall = networkExpectations[0];
    assert.equal(graphqlCall.promise.kind, 'network.graphql', 'Should detect GraphQL kind');
    assert.equal(graphqlCall.promise.intent, 'graphql');
  });
  
  it('extracts WebSocket connection promise', () => {
    const content = `
      const WS_URL = '/ws/notifications';
      
      function connectWebSocket() {
        const ws = new WebSocket(WS_URL);
        ws.onmessage = (event) => {
          console.log(event.data);
        };
      }
    `;
    
    const result = extractPromises2(content, '/websocket.ts', 'websocket.ts');
    
    const networkExpectations = result.expectations.filter(e => e.type === 'network');
    assert.ok(networkExpectations.length >= 1, 'Should extract WebSocket connection');
    const wsCall = networkExpectations[0];
    assert.equal(wsCall.promise.kind, 'network.ws', 'Should detect WebSocket kind');
    assert.equal(wsCall.promise.value, '/ws/notifications');
  });
  
  it('extracts axios instance with baseURL resolution', () => {
    const content = `
      import axios from 'axios';
      
      const BASE_URL = '/api/v1';
      const api = axios.create({ baseURL: BASE_URL });
      
      async function getUsers() {
        const response = await api.get('/users');
        return response.data;
      }
      
      async function getProfile() {
        const response = await api.get('/profile');
        return response.data;
      }
    `;
    
    const result = extractPromises2(content, '/api-client.ts', 'api-client.ts');
    
    const networkExpectations = result.expectations.filter(e => e.type === 'network');
    assert.ok(networkExpectations.length >= 2, 'Should extract both api calls');
    
    const usersCall = networkExpectations.find(e => e.promise.effectiveUrl === '/api/v1/users');
    assert.ok(usersCall, 'Should resolve baseURL + /users');
    assert.equal(usersCall.promise.rawUrl, '/users');
    
    const profileCall = networkExpectations.find(e => e.promise.effectiveUrl === '/api/v1/profile');
    assert.ok(profileCall, 'Should resolve baseURL + /profile');
    assert.equal(profileCall.promise.rawUrl, '/profile');
  });
  
  it('extracts Redux dispatch with UI context', () => {
    const content = `
      import { useDispatch } from 'react-redux';
      import { userActions } from './store';
      
      function UserProfile() {
        const dispatch = useDispatch();
        
        const handleLogout = () => {
          dispatch(userActions.logout());
        };
        
        return <button onClick={handleLogout}>Logout</button>;
      }
    `;
    
    const result = extractPromises2(content, '/UserProfile.tsx', 'UserProfile.tsx');
    
    const stateExpectations = result.expectations.filter(e => e.type === 'state');
    assert.ok(stateExpectations.length >= 1, 'Should extract Redux dispatch in onClick');
    const logoutAction = stateExpectations[0];
    assert.equal(logoutAction.promise.kind, 'state.redux');
    assert.ok(logoutAction.promise.value.includes('logout'), 'Should capture action name');
  });
  
  it('extracts modal open promise with library import', () => {
    const content = `
      import { Dialog } from '@headlessui/react';
      import { useState } from 'react';
      
      function Settings() {
        const [isOpen, setIsOpen] = useState(false);
        
        const handleOpenModal = () => {
          setIsOpen(true);
        };
        
        return (
          <div>
            <button onClick={handleOpenModal}>Open Settings</button>
            <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
              <div>Modal Content</div>
            </Dialog>
          </div>
        );
      }
    `;
    
    const result = extractPromises2(content, '/Settings.tsx', 'Settings.tsx');
    
    const feedbackExpectations = result.expectations.filter(e => e.type === 'feedback');
    const modalExpectation = feedbackExpectations.find(e => e.promise.kind === 'feedback.modal');
    assert.ok(modalExpectation, 'Should extract modal open feedback');
    assert.ok(modalExpectation.selector, 'Should have selector for modal');
  });
  
  it('handles complex template literal resolution', () => {
    const content = `
      const BASE = '/api';
      const VERSION = 'v2';
      const RESOURCE = 'users';
      const ID = '456';
      
      const router = { push: () => {} };
      router.push(\`\${BASE}/\${VERSION}/\${RESOURCE}/\${ID}\`);
    `;
    
    const result = extractPromises2(content, '/test.ts', 'test.ts');
    
    const navExpectations = result.expectations.filter(e => e.type === 'navigation');
    assert.ok(navExpectations.length >= 1, 'Should extract navigation');
    const navCall = navExpectations[0];
    assert.equal(navCall.promise.value, '/api/v2/users/456', 'Should resolve complex template');
  });
  
  it('tracks skip reasons for dynamic expressions', () => {
    const content = `
      const router = { push: () => {} };
      
      // Dynamic identifier
      router.push(props.path);
      
      // Dynamic call
      router.push(getPath());
      
      // Dynamic member
      router.push(config.basePath);
      
      // Dynamic conditional
      router.push(isAdmin ? '/admin' : '/user');
      
      // Dynamic template expression
      router.push(\`/users/\${props.id}\`);
    `;
    
    const result = extractPromises2(content, '/test.ts', 'test.ts');
    
    // Should not extract any navigation promises (all dynamic)
    const navExpectations = result.expectations.filter(e => e.type === 'navigation');
    assert.equal(navExpectations.length, 0, 'Should not extract dynamic navigations');
    
    // Should track skip reasons
    assert.ok(result.skipped.dynamic_identifier > 0, 'Should track dynamic_identifier');
    assert.ok(result.skipped.dynamic_call > 0, 'Should track dynamic_call');
    assert.ok(result.skipped.dynamic_member > 0, 'Should track dynamic_member');
    assert.ok(result.skipped.dynamic_conditional > 0, 'Should track dynamic_conditional');
    assert.ok(result.skipped.dynamic_template_expr > 0, 'Should track dynamic_template_expr');
  });
  
  it('maintains determinism across multiple extractions', () => {
    const content = `
      const router = { push: () => {} };
      const BASE = '/dashboard';
      router.push(\`\${BASE}/settings\`);
      
      fetch('/api/users');
      
      import toast from 'react-hot-toast';
      toast.success('Done');
    `;
    
    const result1 = extractPromises2(content, '/test.tsx', 'test.tsx');
    const result2 = extractPromises2(content, '/test.tsx', 'test.tsx');
    const result3 = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    // Should produce identical results
    assert.equal(result1.expectations.length, result2.expectations.length);
    assert.equal(result2.expectations.length, result3.expectations.length);
    
    // Skip reasons should match
    assert.deepEqual(result1.skipped, result2.skipped);
    assert.deepEqual(result2.skipped, result3.skipped);
    
    // Expectation content should match
    for (let i = 0; i < result1.expectations.length; i++) {
      assert.equal(result1.expectations[i].promise.value, result2.expectations[i].promise.value);
      assert.equal(result1.expectations[i].source.line, result2.expectations[i].source.line);
      assert.equal(result1.expectations[i].type, result2.expectations[i].type);
    }
  });
  
  it('marks all expectations with extractionVersion 2.0', () => {
    const content = `
      const router = { push: () => {} };
      router.push('/dashboard');
      fetch('/api/data');
      import toast from 'react-hot-toast';
      toast('Message');
    `;
    
    const result = extractPromises2(content, '/test.tsx', 'test.tsx');
    
    assert.ok(result.expectations.length > 0, 'Should extract expectations');
    result.expectations.forEach((exp) => {
      assert.equal(exp.extractionVersion, '2.0', 'All expectations should have version 2.0');
    });
  });
});
