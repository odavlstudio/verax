import React from "react";

/**
 * Renders an absolute-positioned glow behind content.
 * Place inside a relatively positioned container.
 */
export function GlowBackdrop({ className = "" }: { className?: string }) {
  return <div className={("glow-backdrop " + className).trim()} aria-hidden="true" />;
}

export default GlowBackdrop;
