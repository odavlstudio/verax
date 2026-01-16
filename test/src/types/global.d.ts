/**
 * Global type declarations for VERAX
 * These extend built-in types to support runtime-injected properties
 */

// Extend Window interface for browser-injected properties
declare global {
  interface Window {
    __veraxNavTracking?: any;
    next?: any;
    __REDUX_STORE__?: any;
    store?: any;
    __REDUX_DEVTOOLS_EXTENSION__?: any;
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: any;
    __VERAX_STATE_SENSOR__?: any;
    __unhandledRejections?: any[];
    __ZUSTAND_STORE__?: any;
  }
}

// Playwright Page type (imported from playwright)
import type { Page as PlaywrightPage } from 'playwright';

// Re-export for use in JS files
export type Page = PlaywrightPage;

// Node.js built-in module declarations
declare module 'fs' {
  export interface Stats {
    isDirectory(): boolean;
    isFile(): boolean;
    size: number;
    mtime: Date;
  }

  export interface WriteFileOptions {
    encoding?: BufferEncoding;
    mode?: number;
    flag?: string;
  }

  export interface ReadFileOptions {
    encoding?: BufferEncoding | string;
    flag?: string;
  }

  export interface RmOptions {
    force?: boolean;
    recursive?: boolean;
    maxRetries?: number;
  }

  export interface MkdirOptions {
    recursive?: boolean;
    mode?: number;
  }

  export interface ReaddirOptions {
    encoding?: BufferEncoding | string;
    withFileTypes?: boolean;
  }

  export function readFileSync(path: string | Buffer, encoding?: string | ReadFileOptions): string | Buffer;
  export function writeFileSync(path: string, data: string | Buffer, options?: WriteFileOptions | string): void;
  export function existsSync(path: string | Buffer): boolean;
  export function mkdirSync(path: string, options?: MkdirOptions): string | undefined;
  export function rmSync(path: string, options?: RmOptions): void;
  export function readdirSync(path: string, options?: ReaddirOptions | string): string[] | any[];
  export function statSync(path: string): Stats;
  export function renameSync(oldPath: string, newPath: string): void;
  export function unlinkSync(path: string): void;
  export function mkdtempSync(prefix: string): string;
  export function appendFileSync(path: string, data: string | Buffer, options?: WriteFileOptions | string): void;
  export function createWriteStream(path: string, options?: any): any;
}

declare module 'path' {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
  export function relative(from: string, to: string): string;
  export function normalize(p: string): string;
  export const sep: string;
  export const delimiter: string;
  export const posix: {
    resolve: typeof resolve;
    join: typeof join;
    dirname: typeof dirname;
    basename: typeof basename;
  };
  export const win32: {
    resolve: typeof resolve;
    join: typeof join;
    dirname: typeof dirname;
    basename: typeof basename;
  };
}

declare module 'crypto' {
  export interface Hash {
    update(data: string | Buffer, encoding?: string): Hash;
    digest(encoding?: string): string | Buffer;
  }

  export function createHash(algorithm: string): Hash;
  export function randomBytes(size: number): Buffer;
  export function createHmac(algorithm: string, key: string | Buffer): {
    update(data: string | Buffer, encoding?: string): any;
    digest(encoding?: string): string;
  };
}

declare module 'os' {
  export function tmpdir(): string;
  export function cwd(): string;
}

declare module 'url' {
  export function fileURLToPath(url: string | URL): string;
  export class URL {
    constructor(input: string, base?: string | URL);
    href: string;
    protocol: string;
    host: string;
    pathname: string;
  }
}

declare module 'http' {
  export interface Server {
    close(callback?: () => void): void;
    listen(port?: number, host?: string, callback?: () => void): void;
  }

  export function createServer(requestListener?: (req: any, res: any) => void): Server;
}

declare global {
  class Buffer {
    static from(data: string, encoding?: string): Buffer;
    static isBuffer(obj: any): obj is Buffer;
    toString(encoding?: string): string;
  }

  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
    }

    interface Process {
      env: ProcessEnv;
      argv: string[];
      cwd(): string;
      exit(code?: number): never;
      on(event: string, listener: (...args: any[]) => void): void;
    }
  }

  const process: NodeJS.Process;
}

export {};

