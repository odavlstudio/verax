'use client';

import { motion } from 'framer-motion';
import { Eye, MousePointer, AlertCircle, FileCode, MessageSquare, Globe } from 'lucide-react';

const steps = [
  {
    number: '1',
    title: 'Scan the page',
    description: 'Guardian opens the page like a real visitor and discovers meaningful interactions.',
    icon: Eye,
  },
  {
    number: '2',
    title: 'Perform interactions',
    description: 'It clicks buttons, submits forms, and toggles UI elements — just like a human would.',
    icon: MousePointer,
  },
  {
    number: '3',
    title: 'Observe the outcome',
    description: 'If nothing visibly or logically happens, Guardian flags a silent failure.',
    icon: AlertCircle,
  },
];

const findings = [
  {
    icon: MousePointer,
    title: 'Button that looks clickable but does nothing',
    description: 'Visual affordance with no action attached.',
  },
  {
    icon: FileCode,
    title: 'Form submission with no confirmation',
    description: 'User input sent nowhere, no feedback displayed.',
  },
  {
    icon: Globe,
    title: "Language toggle that doesn't change content",
    description: 'UI element responds but produces no effect.',
  },
];

const ciFeatures = [
  'Warn by default',
  'Block only when you choose',
  'Evidence-first (screenshots + JSON)',
  'Built for human review',
];

export default function HowItWorks() {
  return (
    <section className="relative py-32 px-4" id="how-it-works">
      <div className="max-w-6xl mx-auto">
        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-6 tracking-tight">
            How Guardian works
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto">
            Guardian behaves like a real user — and watches what actually happens.
          </p>
        </motion.div>

        {/* Three-step flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.15 }}
              >
                <div className="glass-hover rounded-xl p-8 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-signal-orange/10 border border-signal-orange/30 flex items-center justify-center">
                      <span className="text-signal-orange text-sm font-semibold">{step.number}</span>
                    </div>
                    <Icon className="w-5 h-5 text-signal-orange" strokeWidth={2} />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-3 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-text-muted leading-relaxed text-[15px]">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Important note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-24"
        >
          <div className="glass rounded-xl p-6 border-l-2 border-signal-orange">
            <p className="text-text-secondary text-center text-base">
              Guardian does not judge intent. It reports observable reality.
            </p>
          </div>
        </motion.div>

        {/* What Guardian finds */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-24"
        >
          <h3 className="text-3xl font-bold text-text-primary mb-12 text-center tracking-tight">
            What Guardian finds
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {findings.map((finding, index) => {
              const Icon = finding.icon;
              return (
                <motion.div
                  key={finding.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.15 }}
                >
                  <div className="glass-hover rounded-xl p-7 h-full">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brown-medium/20 mb-5 border border-brown-border/20">
                      <Icon className="w-5 h-5 text-signal-orange" strokeWidth={2} />
                    </div>
                    <h4 className="text-base font-semibold text-text-primary mb-2 tracking-tight leading-snug">
                      {finding.title}
                    </h4>
                    <p className="text-text-muted text-sm leading-relaxed">
                      {finding.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Designed for CI */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <h3 className="text-3xl font-bold text-text-primary mb-8 text-center tracking-tight">
            Designed for CI without breaking trust
          </h3>
          <div className="glass rounded-xl p-8 max-w-2xl mx-auto">
            <ul className="space-y-4">
              {ciFeatures.map((feature, index) => (
                <motion.li
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-signal-orange flex-shrink-0" />
                  <span className="text-text-secondary text-base">{feature}</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-brown-border/20">
              <p className="text-text-muted text-sm text-center">
                Signal, not truth. Built for human review.
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <a
            href="#see-example"
            className="inline-block px-8 py-4 rounded-lg bg-signal-orange text-base-black text-base font-semibold hover:bg-signal-orange-deep hover:glow-warm transition-all duration-500"
          >
            See what it finds
          </a>
          <p className="text-text-muted text-sm mt-4">
            Real output. No signup required.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
