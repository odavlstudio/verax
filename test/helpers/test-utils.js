import { setTimeout as sleep } from 'timers/promises';

// Wrap a promise with a hard timeout
export async function withTimeout(promise, ms, label = 'operation') {
  let timer;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Safe server close
export async function safeCloseServer(server) {
  if (!server) return;
  await new Promise((resolve) => {
    try {
      server.close(() => resolve());
    } catch {
      resolve();
    }
  });
}

// Safe child process kill
export async function safeKill(proc) {
  if (!proc) return;
  try {
    proc.kill();
  } catch {
    // ignore
  }
  // Give the process a brief moment to exit
  await sleep(50);
}