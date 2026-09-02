interface PanelProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Panel({ title, subtitle, action, children, className = "", id }: PanelProps) {
  return (
    <div id={id} className={`bg-surface-card rounded-xl shadow-card border border-gray-100 overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
          <div>
            {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
