/**
 * Wave 5 — Artifact Packaging
 * 
 * Creates a zip file containing scan artifacts.
 * Cross-platform using archiver library.
 */

import { createWriteStream } from 'fs';
import { dirname, resolve, basename } from 'path';
import { mkdirSync } from 'fs';
import { getTimeProvider } from '../../cli/util/support/time-provider.js';

// Dynamic import for archiver (dev dependency)
let archiver;
async function getArchiver() {
  if (!archiver) {
    // @ts-expect-error - archiver is an optional dev dependency, types may not be available
    archiver = (await import('archiver')).default;
  }
  return archiver;
}

/**
 * Create a zip file containing artifacts from a run directory
 * @param {string} runDir - Directory containing artifacts (e.g., .verax/runs/<runId>)
 * @param {string} outputPath - Full path where zip should be created (optional, defaults to runDir/artifacts.zip)
 * @returns {Promise<string>} Path to created zip file
 */
export async function createArtifactsZip(runDir, outputPath = null, timeProvider = getTimeProvider()) {
  const Archiver = await getArchiver();
  
  return new Promise((resolvePromise, reject) => {
    // Determine output path
    if (!outputPath) {
      outputPath = resolve(runDir, 'artifacts.zip');
    }
    
    // Ensure parent directory exists
    mkdirSync(dirname(outputPath), { recursive: true });
    
    // Create write stream
    const output = createWriteStream(outputPath);
    const archive = Archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Handle errors
    archive.on('error', (err) => {
      output.destroy();
      reject(err);
    });
    
    output.on('close', () => {
      resolvePromise(outputPath);
    });
    
    output.on('error', (err) => {
      archive.destroy();
      reject(err);
    });
    
    // Pipe archive data to file
    archive.pipe(output);
    
    // Add directory contents to archive
    // Use glob pattern to include all files recursively
    const archiveDate = typeof timeProvider?.date === 'function' ? timeProvider.date() : undefined;
    const directoryOptions = archiveDate ? { date: archiveDate } : undefined;
    archive.directory(runDir, basename(runDir), directoryOptions);
    
    // Finalize the archive
    archive.finalize();
  });
}




