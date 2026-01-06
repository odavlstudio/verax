import { glob } from 'glob';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

async function hasReactDependency(projectDir) {
  try {
    const packageJsonPath = resolve(projectDir, 'package.json');
    if (!existsSync(packageJsonPath)) return false;
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    return !!deps.react;
  } catch (error) {
    return false;
  }
}

async function hasNextJs(projectDir) {
  try {
    const packageJsonPath = resolve(projectDir, 'package.json');
    if (!existsSync(packageJsonPath)) return false;
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    return !!deps.next;
  } catch (error) {
    return false;
  }
}

async function hasReactRouter(projectDir) {
  try {
    const packageJsonPath = resolve(projectDir, 'package.json');
    if (!existsSync(packageJsonPath)) return false;
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    return !!deps['react-router-dom'] || !!deps['react-router'];
  } catch (error) {
    return false;
  }
}

export async function detectProjectType(projectDir) {
  const appDir = resolve(projectDir, 'app');
  const pagesDir = resolve(projectDir, 'pages');
  
  try {
    if (existsSync(appDir)) {
      const appFiles = await glob('**/page.{js,jsx,ts,tsx}', { cwd: appDir, absolute: false });
      if (appFiles.length > 0) {
        return 'nextjs_app_router';
      }
    }
    
    if (existsSync(pagesDir)) {
      const pagesFiles = await glob('**/*.{js,jsx,ts,tsx}', { cwd: pagesDir, absolute: false });
      if (pagesFiles.length > 0) {
        return 'nextjs_pages_router';
      }
    }
    
    const hasReact = await hasReactDependency(projectDir);
    const hasNext = await hasNextJs(projectDir);
    
    if (hasReact && !hasNext) {
      return 'react_spa';
    }
    
    const htmlFiles = await glob('**/*.html', { cwd: projectDir, absolute: false, ignore: ['node_modules/**'] });
    if (htmlFiles.length > 0) {
      return 'static';
    }
  } catch (error) {
    // Fall through to unknown
  }
  
  return 'unknown';
}

export async function hasReactRouterDom(projectDir) {
  return await hasReactRouter(projectDir);
}

