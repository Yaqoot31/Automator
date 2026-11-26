import { useState } from 'react';
import { MEDIA_ASSETS } from '@/lib/mediaAssets';
import type { DemoDefinition } from '@/types';

interface DemoCardPreviewProps {
  demo: DemoDefinition;
}

export function DemoCardPreview({ demo }: DemoCardPreviewProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const imageMap: Record<string, { src: string; alt: string }> = {
    dashboard: {
      src: MEDIA_ASSETS.demoDashboard,
      alt: 'Isometric dark slate analytics dashboard visualization',
    },
    devices: {
      src: MEDIA_ASSETS.demoDevices,
      alt: 'Titanium laptop, tablet, and smartphone showing multi-device support',
    },
    hero: {
      src: MEDIA_ASSETS.heroBackdrop,
      alt: 'Architectural layered glass planes representing desktop studio workspace',
    },
    aurora: {
      src: MEDIA_ASSETS.demoAurora,
      alt: 'Brushed titanium and smoked glass customizable dark wallpaper',
    },
  };

  const photo = imageMap[demo.previewImage];

  if (photo && !imgFailed) {
    return (
      <div className="relative h-44 w-full overflow-hidden rounded-t-xl border-b bg-[var(--surface-elevated)]">
        <img
          src={photo.src}
          alt={photo.alt}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(8,9,12,0.55) 0%, transparent 55%)',
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative h-44 w-full overflow-hidden rounded-t-xl border-b bg-[var(--surface-elevated)] p-4 flex items-center justify-center">
      {demo.previewImage === 'schematic-nav' && (
        <div className="w-full h-full rounded-lg border bg-[var(--surface-panel)] flex overflow-hidden">
          <div className="w-1/4 border-r p-2 space-y-1.5">
            <div className="h-2 w-10 rounded bg-[var(--accent-primary)] opacity-80" />
            <div className="h-1.5 w-12 rounded bg-[var(--text-muted)] opacity-40" />
            <div className="h-1.5 w-9 rounded bg-[var(--text-muted)] opacity-30" />
            <div className="h-1.5 w-11 rounded bg-[var(--text-muted)] opacity-30" />
          </div>
          <div className="flex-1 p-2.5 space-y-2">
            <div className="flex items-center justify-between border-b pb-1.5">
              <div className="h-2 w-24 rounded bg-[var(--text-secondary)] opacity-40" />
              <div className="h-3 w-10 rounded bg-[var(--accent-soft)]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-14 rounded border bg-[var(--surface-elevated)]" />
              <div className="h-14 rounded border bg-[var(--surface-elevated)]" />
            </div>
          </div>
        </div>
      )}

      {demo.previewImage === 'schematic-settings' && (
        <div className="w-full h-full rounded-lg border bg-[var(--surface-panel)] p-3 space-y-2.5">
          {[0.75, 0.45, 0.85].map((fill, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <div className="h-2 w-24 rounded bg-[var(--text-secondary)] opacity-40" />
              <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${fill * 100}%`,
                    backgroundColor:
                      idx === 1 ? 'var(--accent-secondary)' : 'var(--accent-primary)',
                  }}
                />
              </div>
              <div className="w-7 h-3.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-primary)]" />
            </div>
          ))}
        </div>
      )}

      {demo.previewImage === 'schematic-motion' && (
        <div className="w-full h-full rounded-lg border bg-[var(--surface-panel)] p-3 flex flex-col justify-between">
          <svg viewBox="0 0 220 80" className="w-full h-24 overflow-visible">
            <path
              d="M 8 68 C 48 68, 60 12, 110 12 C 160 12, 172 68, 212 18"
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 8 68 C 70 68, 95 26, 212 26"
              fill="none"
              stroke="var(--accent-secondary)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <circle cx="110" cy="12" r="4" fill="var(--accent-primary)" />
            <circle cx="212" cy="18" r="4" fill="var(--accent-secondary)" />
          </svg>
          <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
            <span>cubic-bezier(0.16, 1, 0.3, 1)</span>
            <span>180ms</span>
          </div>
        </div>
      )}

      {demo.previewImage === 'schematic-pipeline' && (
        <div className="w-full h-full rounded-lg border bg-[var(--surface-panel)] p-3 flex items-center justify-between gap-2">
          {['Discover', 'Classify', 'Locate', 'Export'].map((step, i) => (
            <div key={step} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-8 h-8 rounded-lg border flex items-center justify-center font-mono text-xs font-semibold"
                style={{
                  borderColor: i === 2 ? 'var(--accent-primary)' : 'var(--border-strong)',
                  backgroundColor: i === 2 ? 'var(--accent-soft)' : 'var(--surface-elevated)',
                  color: 'var(--text-main)',
                }}
              >
                {i + 1}
              </div>
              <span className="text-[10px] text-[var(--text-secondary)]">{step}</span>
            </div>
          ))}
        </div>
      )}

      {demo.previewImage === 'schematic-personalize' && (
        <div className="w-full h-full rounded-lg border bg-[var(--surface-panel)] p-3 flex flex-col justify-between">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 rounded border bg-[var(--surface-elevated)]" />
            <div className="h-10 rounded border border-[var(--accent-primary)] bg-[var(--accent-soft)]" />
            <div className="h-10 rounded border bg-[var(--surface-elevated)]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#d4a017]" />
            <div className="w-4 h-4 rounded-full bg-[#0d9488]" />
            <div className="w-4 h-4 rounded-full bg-[#2563eb]" />
            <div className="w-4 h-4 rounded-full bg-[#059669]" />
            <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-elevated)] ml-2" />
          </div>
        </div>
      )}

      {demo.previewImage === 'schematic-workflow' && (
        <div className="w-full h-full rounded-lg border bg-[var(--surface-panel)] p-3 flex flex-col justify-between">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex-1 flex items-center gap-1">
                <div
                  className="h-2 w-full rounded-full"
                  style={{
                    backgroundColor:
                      n <= 3 ? 'var(--accent-primary)' : 'var(--surface-elevated)',
                  }}
                />
              </div>
            ))}
          </div>
          <div className="rounded border bg-[var(--surface-canvas)] p-2 font-mono text-[10px] text-[var(--text-secondary)] space-y-1">
            <div className="text-[var(--accent-secondary)]">GET /checkout → 200 OK</div>
            <div>Generated CheckoutPage.ts + spec</div>
          </div>
        </div>
      )}

      {photo && imgFailed && (
        <div className="text-xs font-mono text-[var(--text-muted)]">
          {demo.title}
        </div>
      )}
    </div>
  );
}
