/* (FigmaMake, 2025) */
import * as React from "react";


type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "outline";
};

// for a "pill" label, with outline
export function Badge({ variant = "default", className = "", ...props }: Props) {
  const v = variant === "outline" ? "badge badge-outline" : "badge";
  return <span className={`${v} ${className}`.trim()} {...props} />;
}
