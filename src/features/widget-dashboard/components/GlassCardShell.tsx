import type { PropsWithChildren } from 'react';

interface GlassCardShellProps {
  width: number;
  height: number;
  className?: string;
}

export function GlassCardShell({ width, height, className, children }: PropsWithChildren<GlassCardShellProps>) {
  return (
    <section className={['dashboard-glass-card', className].filter(Boolean).join(' ')} style={{ width, height }}>
      {children}
    </section>
  );
}
