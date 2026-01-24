/**
 * Wave 1 — Context Validator
 *
 * Validates that the target URL matches the project being analyzed.
 * Checks if extracted routes exist on the live site by:
 * 1. Fetching the homepage and parsing internal links
 * 2. Checking if any extracted route paths match internal links
 * 3. For SPAs, also checking if routes return 200 (SPA fallback)
 */

import { chromium } from 'playwright';
import { parse } from 'node-html-parser';

const CONTEXT_CHECK_TIMEOUT_MS = 8000;
const MAX_ROUTES_TO_CHECK = 20;
const MAX_LINKS_TO_PARSE = 100;

function normalizePathForContext(path) {
	if (!path) return '/';

	let normalized = path.split('#')[0].split('?')[0];
	if (!normalized.startsWith('/')) {
		normalized = '/' + normalized;
	}

	// Normalize common static site patterns
	if (normalized.toLowerCase() === '/index.html') {
		return '/';
	}

	if (normalized.toLowerCase().endsWith('.html')) {
		normalized = normalized.slice(0, -5) || '/';
	}

	if (normalized.endsWith('/') && normalized !== '/') {
		normalized = normalized.slice(0, -1) || '/';
	}

	return normalized || '/';
}

/**
 * Validate context by checking if project routes match live site
 * @param {Object} manifest - Manifest with routes and projectType
 * @param {string} baseUrl - Target URL to validate against
 * @param {boolean} forced - Whether --force flag was used
 * @returns {Promise<Object>} Context check result
 */
export async function validateContext(manifest, baseUrl, forced = false) {
	const publicRoutes = manifest.publicRoutes || [];
	const projectType = manifest.projectType || 'unknown';

	// If no routes extracted, context validation doesn't apply
	if (publicRoutes.length === 0) {
		return {
			ran: false,
			forced: forced,
			verdict: null,
			matchedRoutesCount: 0,
			matchedLinksCount: 0,
			sampleMatched: [],
			reason: 'no_routes_extracted'
		};
	}

	// For file:// URLs (local development/testing), assume context is valid if any route is extracted
	// since we can't reliably validate local file system paths
	if (baseUrl.startsWith('file://')) {
		return {
			ran: true,
			forced: forced,
			verdict: 'VALID_CONTEXT',
			matchedRoutesCount: publicRoutes.length,
			matchedLinksCount: publicRoutes.length,
			sampleMatched: publicRoutes.slice(0, 5),
			reason: 'file_protocol_skip_validation'
		};
	}

	let baseOrigin;
	let basePathCandidate;
	try {
		const urlObj = new URL(baseUrl);
		baseOrigin = urlObj.origin;
		// Treat the requested URL path as a candidate route so static sites without links still match
		const basePath = normalizePathForContext(urlObj.pathname);
		// Include the base path in the internal link set so at least one known route can match
		// when the homepage itself is part of the manifest.
		basePathCandidate = basePath;
	} catch (error) {
		return {
			ran: false,
			forced: forced,
			verdict: null,
			matchedRoutesCount: 0,
			matchedLinksCount: 0,
			sampleMatched: [],
			reason: 'invalid_url'
		};
	}

	// Normalize route paths for comparison
	const normalizedRoutes = publicRoutes
		.slice(0, MAX_ROUTES_TO_CHECK)
		.map(route => normalizePathForContext(route));

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 720 }
	});
	const page = await context.newPage();

	try {
		// Fetch homepage and parse internal links
		await page.goto(baseUrl, {
			waitUntil: 'domcontentloaded',
			timeout: CONTEXT_CHECK_TIMEOUT_MS
		});

		await page.waitForTimeout(500); // Allow SPA to render

		const html = await page.content();
		const root = parse(html);
		const links = root.querySelectorAll('a[href]');

		// Extract internal links
		const internalLinks = new Set();
		if (basePathCandidate) {
			internalLinks.add(basePathCandidate);
		}
		for (const link of links.slice(0, MAX_LINKS_TO_PARSE)) {
			const href = link.getAttribute('href');
			if (!href) continue;

			try {
				// Resolve relative URLs
				const resolvedUrl = new URL(href, baseUrl);
				if (resolvedUrl.origin === baseOrigin) {
					const normalizedPath = normalizePathForContext(resolvedUrl.pathname);
					internalLinks.add(normalizedPath);
				}
			} catch (e) {
				// If href is relative, try direct path matching
				if (href.startsWith('/') || (!href.startsWith('http') && !href.startsWith('#'))) {
					const path = href.split('#')[0].split('?')[0];
					const normalizedPath = normalizePathForContext(path);
					internalLinks.add(normalizedPath);
				}
			}
		}

		// Check route reachability for SPAs (may return 200 due to fallback)
		const routeReachabilityChecks = [];
		if (projectType === 'react_spa' || projectType.startsWith('nextjs_')) {
			// Sample a few routes to check if they return 200 (SPA fallback)
			const routesToCheck = normalizedRoutes.slice(0, 5);
			for (const routePath of routesToCheck) {
				const candidates = new Set([routePath]);
				if (routePath === '/') {
					candidates.add('/index.html');
				} else if (!routePath.endsWith('.html')) {
					candidates.add(`${routePath}.html`);
				}

				for (const candidate of candidates) {
					try {
						const routeUrl = baseOrigin + candidate;
						const routeResponse = await page.goto(routeUrl, {
							waitUntil: 'domcontentloaded',
							timeout: CONTEXT_CHECK_TIMEOUT_MS
						});
						if (routeResponse && routeResponse.status() >= 200 && routeResponse.status() < 300) {
							routeReachabilityChecks.push(routePath);
							break;
						}
					} catch (e) {
						// Route check failed
					}
				}
			}
		}

		// Find intersection: routes that match internal links or are reachable
		const matchedRoutes = new Set();
		const matchedLinks = new Set();
		const sampleMatched = [];

		for (const route of normalizedRoutes) {
			if (internalLinks.has(route)) {
				matchedRoutes.add(route);
				matchedLinks.add(route);
				if (sampleMatched.length < 5) {
					sampleMatched.push(route);
				}
			} else if (routeReachabilityChecks.includes(route)) {
				matchedRoutes.add(route);
				if (sampleMatched.length < 5) {
					sampleMatched.push(route);
				}
			}
		}

		const matchedRoutesCount = matchedRoutes.size;
		const matchedLinksCount = matchedLinks.size;
		const totalRoutes = normalizedRoutes.length;

		// Require at least a majority of routes to match to trust the context
		const requiredMatches = totalRoutes > 0 ? Math.max(1, Math.ceil(totalRoutes / 2)) : 0;

		let verdict = null;
		if (totalRoutes > 0 && matchedRoutesCount < requiredMatches) {
			verdict = forced ? 'INVALID_CONTEXT_FORCED' : 'INVALID_CONTEXT';
		} else {
			verdict = 'VALID_CONTEXT';
		}

		return {
			ran: true,
			forced: forced,
			verdict: verdict,
			matchedRoutesCount: matchedRoutesCount,
			matchedLinksCount: matchedLinksCount,
			totalRoutesChecked: totalRoutes,
			sampleMatched: sampleMatched,
			internalLinksFound: internalLinks.size,
			reason: matchedRoutesCount < requiredMatches ? 'insufficient_route_match' : 'routes_matched'
		};

	} catch (error) {
		// Context check failed - can't determine validity
		return {
			ran: true,
			forced: forced,
			verdict: forced ? 'INVALID_CONTEXT_FORCED' : 'INVALID_CONTEXT',
			matchedRoutesCount: 0,
			matchedLinksCount: 0,
			sampleMatched: [],
			reason: 'context_check_failed',
			error: error.message
		};
	} finally {
		await browser.close();
	}
}



