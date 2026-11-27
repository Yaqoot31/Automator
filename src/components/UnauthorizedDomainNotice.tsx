import { useState } from 'react';
import { Check, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import { FIREBASE_META } from '@/lib/firebase';

interface UnauthorizedDomainNoticeProps {
  contextLabel?: string;
}

export function UnauthorizedDomainNotice({
  contextLabel = 'Google Sign-In',
}: UnauthorizedDomainNoticeProps) {
  const [copied, setCopied] = useState(false);
  const hostname =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : 'your-app-domain';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  };

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs space-y-2.5 text-[var(--text-main)]"
    >
      <div className="flex items-start gap-2 text-[var(--status-warning)] font-semibold">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Authorize this domain in Firebase Console to enable {contextLabel}
        </span>
      </div>
      <p className="text-[var(--text-secondary)] leading-relaxed">
        Firebase Authentication blocks popup sign-in from domains not listed under{' '}
        <span className="font-medium text-[var(--text-main)]">
          Authentication → Settings → Authorized domains
        </span>
        . Add the current hostname below:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg surface-elevated font-mono text-[11px] truncate">
          {hostname}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 min-h-[34px] rounded-lg surface-panel border hover:bg-[var(--surface-hover)] text-[11px] font-medium shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--status-success)]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Domain'}</span>
        </button>
        <a
          href={FIREBASE_META.authorizedDomainsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 min-h-[34px] rounded-lg font-semibold text-[11px] shrink-0"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          <span>Authorized Domains</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
