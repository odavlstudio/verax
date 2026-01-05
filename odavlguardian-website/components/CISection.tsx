'use client';

import { motion } from 'framer-motion';
import { Terminal } from 'lucide-react';

export default function CISection() {
  return (
    <section className="relative py-24 px-4" id="ci">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4 tracking-tight">
            Use Guardian in CI (Minimal)
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="glass rounded-xl p-8 mb-8"
        >
          <p className="text-text-secondary text-lg mb-8 leading-relaxed max-w-2xl mx-auto">
            Guardian can run in CI without blocking builds.
            <br />
            Use warn mode to surface UX signals during pull requests.
          </p>

          <div className="bg-base-dark-1 rounded-lg p-6 font-mono text-sm border border-brown-border/30 overflow-x-auto mb-6">
            <div className="space-y-2">
              <div className="text-text-muted">
                <span className="text-signal-orange">-</span> name: UX Reality Check
              </div>
              <div className="text-text-muted pl-2">
                <span className="text-signal-orange">run:</span> npx @odavl/guardian silent --url ${"{"} env.PREVIEW_URL {"}"} --mode warn
              </div>
            </div>
          </div>

          <div className="text-center text-text-muted text-sm italic">
            Signals only. No failures by default.
          </div>
        </motion.div>
      </div>
    </section>
  );
}
