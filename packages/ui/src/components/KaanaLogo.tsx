import React from "react";

export type KaanaLogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<KaanaLogoSize, string> = {
  xs: "h-5 max-h-5",
  sm: "h-7 max-h-7",
  md: "h-9 max-h-9",
  lg: "h-10 max-h-10",
  xl: "h-12 max-h-12",
};

export function KaanaLogo({
  className,
  size = "md",
  alt = "Kaana Kitchens",
  src = "/kaana-logo.png",
  framed = false,
}: {
  className?: string;
  size?: KaanaLogoSize;
  alt?: string;
  src?: string;
  /** Adds a black frame so the wordmark reads on light backgrounds */
  framed?: boolean;
}) {
  const imgClass = className ?? `${SIZE_CLASS[size]} w-auto max-w-[160px]`;
  const img = <img src={src} alt={alt} className={`object-contain object-left shrink-0 ${imgClass}`} />;

  if (framed) {
    return (
      <div className="inline-flex items-center bg-black rounded-lg px-2.5 py-1.5 shrink-0 max-w-full overflow-hidden">
        {img}
      </div>
    );
  }

  return img;
}

export function KaanaBrand({
  appLabel,
  size = "md",
  framed = false,
  className = "",
  labelClassName = "",
}: {
  appLabel?: string;
  size?: KaanaLogoSize;
  framed?: boolean;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 max-w-full ${className}`}>
      <KaanaLogo size={size} framed={framed} />
      {appLabel && (
        <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] truncate ${labelClassName || "text-white/55"}`}>
          {appLabel}
        </p>
      )}
    </div>
  );
}
