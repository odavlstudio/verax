'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const useWhen = [
  'Before a release to catch UX regressions',
  'In PRs using warn mode',
  "When you don't have full E2E coverage yet",
  "To discover issues users see but logs don't",
];

const notFor = [
  'A replacement for Playwright tests',
  'A production monitoring system',
  'A default CI gate',
  'A judge of intent',
];

export default function WhenToUse() {
  return (
    <section className="relative py-32 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-6 tracking-tight">
            When verax is the right tool
          </h2>
        </motion.div>

        {/* Two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEFT: Use verax when */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="glass rounded-xl p-8 h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-signal-orange/10 border border-signal-orange/30 flex items-center justify-center">
                  <Check className="w-5 h-5 text-signal-orange" strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-semibold text-text-primary tracking-tight">
                  Use verax when
                </h3>
              </div>
              <ul className="space-y-4">
                {useWhen.map((item, index) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-signal-orange mt-2 flex-shrink-0" />
                    <span className="text-text-secondary leading-relaxed">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* RIGHT: verax is NOT */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="glass rounded-xl p-8 h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-brown-medium/20 border border-brown-border/30 flex items-center justify-center">
                  <X className="w-5 h-5 text-text-muted" strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-semibold text-text-primary tracking-tight">
                  verax is NOT
                </h3>
              </div>
              <ul className="space-y-4">
                {notFor.map((item, index) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-text-muted mt-2 flex-shrink-0" />
                    <span className="text-text-muted leading-relaxed">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
