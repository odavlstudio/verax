'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Shield, FileCheck } from 'lucide-react';

const features = [
  {
    icon: AlertTriangle,
    title: 'Silent Failure Detection',
    description:
      'Flags interactions that look functional but produce no real effect.',
  },
  {
    icon: Shield,
    title: 'Signal Mode',
    description:
      'Warns by default. Blocks only when you explicitly trust the signal.',
  },
  {
    icon: FileCheck,
    title: 'Evidence-First',
    description:
      'Screenshots, JSON, and optional HAR for fast verification.',
  },
];

export default function FeatureGrid() {
  return (
    <section className="relative py-24 px-4" id="features">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.15, ease: 'easeOut' }}
                className="group relative"
              >
                <div className="glass-hover rounded-xl p-8 h-full">
                  {/* Icon */}
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-brown-medium/20 mb-6 group-hover:bg-signal-orange/10 transition-colors duration-500 border border-brown-border/20">
                    <Icon className="w-5 h-5 text-signal-orange" strokeWidth={2} />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-text-primary mb-3 tracking-tight">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-text-muted leading-relaxed text-[15px]">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
