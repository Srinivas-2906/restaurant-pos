export function PageContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 lg:p-8 max-w-[1400px] mx-auto w-full min-w-0 overflow-x-clip ${className}`}>{children}</div>;
}
