'use client';

import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function CLISection() {
  const [copied, setCopied] = useState(false);
  const command = 'npx @verax/verax silent --url https://example.com';

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative py-32 px-4" id="cli">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
            Run it now
          </h2>
          <p className="text-text-muted text-lg">
            No signup. No install. No CI breakage by default.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="glass rounded-xl p-8"
        >
          {/* Code block */}
          <div className="relative">
            <div className="bg-base-dark-1 rounded-lg p-5 font-mono text-sm overflow-x-auto border border-brown-border/30">
              <code className="text-signal-orange">{command}</code>
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 p-2 rounded-lg glass-hover transition-all duration-300"
              aria-label="Copy command"
            >
              {copied ? (
                <Check className="w-4 h-4 text-signal-orange" strokeWidth={2} />
              ) : (
                <Copy className="w-4 h-4 text-text-muted" strokeWidth={2} />
              )}
            </button>
          </div>

          {/* Quick tip */}
          <div className="mt-6 flex items-start gap-3 px-4 py-3 rounded-lg bg-brown-medium/20 border border-brown-border/30">
            <div className="w-1 h-1 rounded-full bg-signal-orange mt-2 flex-shrink-0" />
            <p className="text-sm text-text-secondary leading-relaxed">
              Run with{' '}
              <code className="px-2 py-0.5 rounded bg-base-dark-1 text-signal-orange text-xs font-mono border border-brown-border/20">
                --mode warn
              </code>{' '}
              in CI — signals only, no build failures.
            </p>
          </div>
        </motion.div>

        {/* Sample output link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-8"
        >
          <a
            href="https://github.com/odavlstudio/verax"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors duration-300 text-sm group"
          >
            <span>See real verax output</span>
            <svg
              className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
