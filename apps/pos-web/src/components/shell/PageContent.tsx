export function PageContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 lg:p-8 max-w-[1400px] mx-auto ${className}`}>{children}</div>;
}
