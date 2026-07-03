interface ProtoDocsLogoProps {
  logoUrl: string;
  logoText?: string;
  showText?: boolean;
  iconClassName?: string;
  imageClassName?: string;
  textClassName?: string;
}

export default function ProtoDocsLogo({
  logoUrl,
  logoText = 'protodocs.dev',
  showText = true,
  iconClassName = 'w-6 h-6',
  imageClassName = iconClassName,
  textClassName = 'font-bold text-base text-app-textBright tracking-wide truncate',
}: ProtoDocsLogoProps) {
  if (logoUrl) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <img src={logoUrl} alt={logoText} className={`${imageClassName} object-contain shrink-0`} />
        {showText && <span className={textClassName}>{logoText}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0 select-none">
      <svg className={`${iconClassName} shrink-0`} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 7h10l5 5v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill="var(--bg-panel)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M19 7v5h5" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        <line x1="12" y1="20" x2="16" y2="15" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        <line x1="16" y1="15" x2="20" y2="18" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        <circle cx="12" cy="20" r="3" fill="var(--syn-option)" />
        <circle cx="16" cy="15" r="3" fill="var(--syn-primitive)" />
        <circle cx="20" cy="18" r="3" fill="var(--syn-string)" />
      </svg>
      {showText && <span className={textClassName}>{logoText}</span>}
    </div>
  );
}
