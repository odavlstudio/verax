/**
 * Run Export - Create ZIP archives of Guardian run artifacts or send to API endpoints
 */

const fs = require('fs');
const archiver = require('archiver');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const yazl = require('yazl');
const { readPointer } = require('./run-latest');
const { readMetaJson } = require('./run-artifacts');
const { buildContractHeaders, validateContractHeaders } = require('./export-contract');

/**
 * Resolve run directory from runId or latest pointer
 * 
 * @param {string|null} runId - Run ID (directory name) or null for latest
 * @param {string} artifactsDir - Artifacts base directory
 * @returns {Object} { runDir, runId, meta } or null if not found
 */
function resolveRunDir(runId, artifactsDir) {
  if (runId) {
    // Explicit runId provided
    const runDir = path.join(artifactsDir, runId);
    if (!fs.existsSync(runDir)) {
      return null;
    }
    
    const meta = readMetaJson(runDir);
    if (!meta) {
      return null;
    }
    
    return { runDir, runId, meta };
  }
  
  // Use LATEST pointer
  const pointerPath = path.join(artifactsDir, 'LATEST.json');
  const pointer = readPointer(pointerPath);
  
  if (!pointer || !pointer.pointedRun) {
    return null;
  }
  
  const runDir = path.join(artifactsDir, pointer.pointedRun);
  if (!fs.existsSync(runDir)) {
    return null;
  }
  
  const meta = readMetaJson(runDir);
  if (!meta) {
    return null;
  }
  
  return { runDir, runId: pointer.pointedRun, meta };
}

/**
 * Check if file should be included in export
 * 
 * @param {string} filePath - Full file path
 * @param {string} runDir - Run directory base path
 * @returns {boolean} true if file should be included
 */
function shouldIncludeFile(filePath, runDir) {
  const relativePath = path.relative(runDir, filePath);
  const segments = relativePath.split(path.sep);
  const basename = path.basename(filePath);
  
  // Exclude patterns
  const excludePatterns = [
    'node_modules',
    '.git',
    '.DS_Store',
    'Thumbs.db',
    '.tmp',
    'temp',
    'tmp'
  ];
  
  // Check if any segment matches exclude patterns
  for (const segment of segments) {
    if (excludePatterns.includes(segment)) {
      return false;
    }
  }
  
  // Exclude temporary files
  if (basename.startsWith('.') && basename !== '.gitkeep') {
    return false;
  }
  
  return true;
}

/**
 * Recursively collect files from run directory
 * 
 * @param {string} dirPath - Directory to scan
 * @param {string} runDir - Root run directory
 * @param {string[]} files - Accumulator for file paths
 */
function collectFiles(dirPath, runDir, files = []) {
  if (!fs.existsSync(dirPath)) {
    return files;
  }
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (!shouldIncludeFile(fullPath, runDir)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      collectFiles(fullPath, runDir, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Create ZIP archive of run artifacts
 * 
 * @param {string} runDir - Run directory to export
 * @param {string} outputPath - Output ZIP file path
 * @returns {Promise<Object>} { success, path, error }
 */
function createZipArchive(runDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const zip = new yazl.ZipFile();

    let fileCount = 0;
    let totalBytes = 0;

    zip.outputStream.pipe(output).on('close', () => {
      resolve({
        success: true,
        path: outputPath,
        fileCount,
        totalBytes
      });
    }).on('error', reject);

    zip.outputStream.on('error', reject);
    output.on('error', reject);

    const files = collectFiles(runDir, runDir);

    for (const filePath of files) {
      const relativePath = path.relative(runDir, filePath);
      const stats = fs.statSync(filePath);
      fileCount++;
      totalBytes += stats.size;
      // Preserve modification time for traceability; compression level is fixed inside yazl
      zip.addFile(filePath, relativePath, { mtime: stats.mtime || new Date(), mode: stats.mode });
    }

    zip.end();
  });
}

/**
 * Format bytes to human-readable string
 * 
 * @param {number} bytes - Bytes count
 * @returns {string} formatted size (e.g., "1.23 MB")
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Export Guardian run to ZIP file
 * 
 * @param {Object} config - Export configuration
 * @param {string|null} config.run - Run ID or null for latest
 * @param {string|null} config.out - Output path or null for auto-generated
 * @param {string} config.artifactsDir - Artifacts directory (default: '.odavlguardian')
 * @returns {Promise<number>} exit code (0 = success, 2 = failure)
 */
async function exportRunToZip(config) {
  const artifactsDir = config.artifactsDir || '.odavlguardian';
  
  // Resolve run directory
  const resolved = resolveRunDir(config.run, artifactsDir);
  
  if (!resolved) {
    if (config.run) {
      console.error(`\n❌ Run not found: ${config.run}`);
      console.error(`   Artifacts directory: ${path.resolve(artifactsDir)}\n`);
    } else {
      console.error(`\n❌ No runs found in artifacts directory`);
      console.error(`   Directory: ${path.resolve(artifactsDir)}`);
      console.error(`   LATEST.json not found or invalid\n`);
    }
    return 2;
  }
  
  const { runDir, runId, meta } = resolved;
  
  // Determine output path - export to tmp dir instead of project root
  const outputPath = config.out 
    ? path.resolve(config.out)
    : path.join(os.tmpdir(), `guardian-export-${runId}.zip`);
  
  // Check if output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    console.error(`\n❌ Output directory does not exist: ${outputDir}\n`);
    return 2;
  }
  
  // Check if output file already exists
  if (fs.existsSync(outputPath)) {
    console.error(`\n❌ Output file already exists: ${outputPath}`);
    console.error(`   Delete it first or choose a different path with --out\n`);
    return 2;
  }
  
  // Print export info
  console.log(`\nExporting Guardian run...`);
  console.log(`  Run ID:     ${runId}`);
  console.log(`  URL:        ${meta.url || 'unknown'}`);
  console.log(`  Timestamp:  ${meta.timestamp || 'unknown'}`);
  console.log(`  Source:     ${runDir}`);
  console.log(`  Output:     ${outputPath}`);
  console.log();
  
  // Create ZIP archive
  try {
    const result = await createZipArchive(runDir, outputPath);
    
    console.log(`✅ Export completed`);
    console.log(`  Files:      ${result.fileCount}`);
    console.log(`  Size:       ${formatBytes(result.totalBytes)}`);
    console.log(`  Location:   ${result.path}`);
    console.log();
    
    return 0;
  } catch (err) {
    console.error(`\n❌ Export failed: ${err.message}\n`);
    
    // Clean up partial file
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch {}
    }
    
    return 2;
  }
}

/**
 * Create temporary ZIP in memory for API export
 * 
 * @param {string} runDir - Run directory to export
 * @returns {Promise<Buffer>} ZIP buffer
 */
function createZipBuffer(runDir) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    archive.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    const files = collectFiles(runDir, runDir);
    for (const filePath of files) {
      const relativePath = path.relative(runDir, filePath);
      archive.file(filePath, { name: relativePath });
    }
    
    archive.finalize();
  });
}

/**
 * Send HTTP POST with retry logic
 * 
 * @param {string} endpoint - HTTP endpoint URL
 * @param {Buffer} zipBuffer - ZIP data
 * @param {Object} metadata - Run metadata
 * @param {number} attempt - Current attempt number (1-indexed)
 * @param {number} maxAttempts - Maximum attempts
 * @returns {Promise<Object>} { success, statusCode, error }
 */
async function httpPostWithRetry(endpoint, zipBuffer, metadata, attempt = 1, maxAttempts = 3) {
  const url = new URL(endpoint);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;
  
  const timeout = 15000; // 15 seconds
  
  // Build headers using contract module
  const contractHeaders = buildContractHeaders(metadata);
  
  // Validate contract before sending
  validateContractHeaders(contractHeaders);
  
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': zipBuffer.length,
      ...contractHeaders
    },
    timeout
  };
  
  return new Promise((resolve) => {
    const req = httpModule.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const statusCode = res.statusCode;
        
        // Success on 2xx
        if (statusCode >= 200 && statusCode < 300) {
          resolve({ success: true, statusCode, body });
          return;
        }
        
        // Retry on 5xx or 429
        const shouldRetry = (statusCode >= 500 || statusCode === 429) && attempt < maxAttempts;
        
        if (shouldRetry) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          setTimeout(() => {
            httpPostWithRetry(endpoint, zipBuffer, metadata, attempt + 1, maxAttempts)
              .then(resolve);
          }, backoffMs);
        } else {
          resolve({ 
            success: false, 
            statusCode, 
            error: `HTTP ${statusCode}`,
            body 
          });
        }
      });
    });
    
    req.on('error', (err) => {
      // Retry on network errors
      const shouldRetry = attempt < maxAttempts;
      
      if (shouldRetry) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        setTimeout(() => {
          httpPostWithRetry(endpoint, zipBuffer, metadata, attempt + 1, maxAttempts)
            .then(resolve);
        }, backoffMs);
      } else {
        resolve({ 
          success: false, 
          error: `Network error: ${err.message}` 
        });
      }
    });
    
    req.on('timeout', () => {
      req.destroy();
      // Retry on timeout
      const shouldRetry = attempt < maxAttempts;
      
      if (shouldRetry) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        setTimeout(() => {
          httpPostWithRetry(endpoint, zipBuffer, metadata, attempt + 1, maxAttempts)
            .then(resolve);
        }, backoffMs);
      } else {
        resolve({ 
          success: false, 
          error: 'Request timeout (15s)' 
        });
      }
    });
    
    req.write(zipBuffer);
    req.end();
  });
}

/**
 * Export Guardian run to API endpoint
 * 
 * @param {Object} config - Export configuration
 * @param {string} config.endpoint - HTTP endpoint URL
 * @param {string|null} config.run - Run ID or null for latest
 * @param {string} config.artifactsDir - Artifacts directory
 * @returns {Promise<number>} exit code (0 = success, 2 = failure)
 */
async function exportRunToAPI(config) {
  const artifactsDir = config.artifactsDir || '.odavlguardian';
  
  // Resolve run directory
  const resolved = resolveRunDir(config.run, artifactsDir);
  
  if (!resolved) {
    if (config.run) {
      console.error(`\n❌ Run not found: ${config.run}`);
      console.error(`   Artifacts directory: ${path.resolve(artifactsDir)}\n`);
    } else {
      console.error(`\n❌ No runs found in artifacts directory`);
      console.error(`   Directory: ${path.resolve(artifactsDir)}`);
      console.error(`   LATEST.json not found or invalid\n`);
    }
    return 2;
  }
  
  const { runDir, runId, meta } = resolved;
  
  // Build metadata
  const metadata = {
    runId,
    url: meta.url || '',
    timestamp: meta.timestamp || '',
    verdict: meta.result || 'UNKNOWN',
    exitCode: meta.result === 'READY' ? 0 : (meta.result === 'FRICTION' ? 1 : 2),
    policy: meta.policy || '',
    preset: meta.preset || ''
  };
  
  console.log(`\nExporting Guardian run to API...`);
  console.log(`  Run ID:     ${runId}`);
  console.log(`  URL:        ${metadata.url}`);
  console.log(`  Verdict:    ${metadata.verdict}`);
  console.log(`  Endpoint:   ${config.endpoint}`);
  console.log();
  
  // Create ZIP buffer
  console.log(`Creating ZIP archive...`);
  let zipBuffer;
  try {
    zipBuffer = await createZipBuffer(runDir);
    console.log(`  Archive size: ${formatBytes(zipBuffer.length)}`);
  } catch (err) {
    console.error(`\n❌ Failed to create archive: ${err.message}\n`);
    return 2;
  }
  
  // Send to API
  console.log(`\nSending to API...`);
  const result = await httpPostWithRetry(config.endpoint, zipBuffer, metadata);
  
  if (result.success) {
    console.log(`✅ Export completed`);
    console.log(`  Status:     ${result.statusCode}`);
    console.log(`  Size sent:  ${formatBytes(zipBuffer.length)}`);
    console.log();
    return 0;
  } else {
    console.error(`\n❌ Export failed`);
    console.error(`  Endpoint:   ${config.endpoint}`);
    if (result.statusCode) {
      console.error(`  Status:     ${result.statusCode}`);
    }
    console.error(`  Error:      ${result.error}`);
    console.error();
    return 2;
  }
}

/**
 * Export Guardian run (router function)
 * 
 * @param {Object} config - Export configuration
 * @param {string} config.type - Export type ('zip' or 'api')
 * @returns {Promise<number>} exit code
 */
async function exportRun(config) {
  const exportType = config.type || 'zip';
  
  if (exportType === 'api') {
    if (!config.endpoint) {
      console.error(`\n❌ API export requires --endpoint <url>\n`);
      return 2;
    }
    return await exportRunToAPI(config);
  } else {
    return await exportRunToZip(config);
  }
}

module.exports = {
  exportRun,
  exportRunToZip,
  exportRunToAPI,
  resolveRunDir,
  createZipArchive,
  createZipBuffer,
  collectFiles,
  shouldIncludeFile,
  formatBytes,
  httpPostWithRetry
};
