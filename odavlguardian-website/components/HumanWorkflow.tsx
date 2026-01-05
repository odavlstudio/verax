'use client';

import { motion } from 'framer-motion';

const workflow = [
  {
    number: '1',
    text: 'Guardian reports a signal',
  },
  {
    number: '2',
    text: 'Engineer opens screenshots & JSON',
  },
  {
    number: '3',
    text: 'Engineer decides: bug, expected behavior, or ignore',
  },
  {
    number: '4',
    text: 'Engineer moves on — nothing is blocked by default',
  },
];

export default function HumanWorkflow() {
  return (
    <section className="relative py-32 px-4 bg-gradient-to-b from-transparent via-brown-dark/10 to-transparent">
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
            How engineers actually use the output
          </h2>
        </motion.div>

        {/* Workflow steps */}
        <div className="space-y-6 mb-12">
          {workflow.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: index * 0.15 }}
              className="flex items-start gap-5"
            >
              <div className="w-10 h-10 rounded-full bg-signal-orange/10 border border-signal-orange/30 flex items-center justify-center flex-shrink-0">
                <span className="text-signal-orange text-sm font-semibold">{step.number}</span>
              </div>
              <div className="pt-2">
                <p className="text-text-secondary text-lg">{step.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Key message */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center"
        >
          <div className="inline-block glass rounded-xl px-8 py-5">
            <p className="text-text-primary text-base">
              Guardian supports human judgment. It does not replace it.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
