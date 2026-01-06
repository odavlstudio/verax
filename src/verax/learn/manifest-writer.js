import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { extractStaticExpectations } from './static-extractor.js';
import { assessLearnTruth } from './truth-assessor.js';

export async function writeManifest(projectDir, projectType, routes) {
  const publicRoutes = routes.filter(r => r.public).map(r => r.path);
  const internalRoutes = routes.filter(r => !r.public).map(r => r.path);
  
  const manifest = {
    version: 1,
    learnedAt: new Date().toISOString(),
    projectDir: projectDir,
    projectType: projectType,
    routes: routes.map(r => ({
      path: r.path,
      source: r.source,
      public: r.public
    })),
    publicRoutes: publicRoutes,
    internalRoutes: internalRoutes,
    notes: []
  };
  
  let staticExpectations = null;
  if (projectType === 'static' && routes.length > 0) {
    staticExpectations = await extractStaticExpectations(projectDir, routes);
    manifest.staticExpectations = staticExpectations;
  }
  
  const learnTruth = await assessLearnTruth(projectDir, projectType, routes, staticExpectations);
  manifest.notes.push({
    type: 'truth',
    learn: learnTruth
  });
  
  const manifestDir = resolve(projectDir, '.veraxverax', 'learn');
  mkdirSync(manifestDir, { recursive: true });
  
  const manifestPath = resolve(manifestDir, 'site-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  
  return {
    ...manifest,
    manifestPath: manifestPath,
    learnTruth: learnTruth
  };
}

