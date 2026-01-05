'use client';

import { motion } from 'framer-motion';
import { Terminal } from 'lucide-react';

export default function RealExample() {
  return (
    <section className="relative py-32 px-4" id="see-example">
      <div className="max-w-5xl mx-auto">
        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-6 tracking-tight">
            A real Guardian run looks like this
          </h2>
        </motion.div>

        {/* Console output */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="glass rounded-xl p-8 mb-8"
        >
          <div className="bg-base-dark-1 rounded-lg p-6 font-mono text-sm border border-brown-border/30 overflow-x-auto">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-signal-orange" strokeWidth={2} />
                <span className="text-text-muted text-xs">guardian silent --url https://example.com</span>
              </div>
              <div className="text-text-muted">
                <span className="text-signal-orange">⚠</span> Silent failure detected
              </div>
              <div className="text-text-secondary pl-4">
                Element: <span className="text-signal-orange">&lt;button&gt;</span> Subscribe to newsletter
              </div>
              <div className="text-text-secondary pl-4">
                Action: <span className="text-text-primary">click</span>
              </div>
              <div className="text-text-secondary pl-4">
                Outcome: <span className="text-text-muted">No visible change, no network request</span>
              </div>
              <div className="text-text-secondary pl-4 mt-4">
                Evidence:
              </div>
              <div className="text-text-muted pl-8">
                → before.png (captured)
              </div>
              <div className="text-text-muted pl-8">
                → after.png (captured)
              </div>
              <div className="text-text-muted pl-8">
                → result.json (saved)
              </div>
              <div className="mt-4 pt-4 border-t border-brown-border/20">
                <div className="text-text-muted text-xs">
                  Run complete. 1 signal detected. Evidence saved to ./guardian-results/
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center mb-12"
        >
          <div className="inline-block glass rounded-xl px-8 py-5">
            <p className="text-text-primary text-base font-medium">
              This is what Guardian actually reports. No scoring. No guessing.
            </p>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center"
        >
          <a
            href="#cli"
            className="inline-block px-8 py-4 rounded-lg bg-signal-orange text-base-black text-base font-semibold hover:bg-signal-orange-deep hover:glow-warm transition-all duration-500"
          >
            Run Guardian on one page
          </a>
        </motion.div>
      </div>
    </section>
  );
}
