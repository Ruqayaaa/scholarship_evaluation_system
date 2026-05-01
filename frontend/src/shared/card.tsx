/* (FigmaMake, 2025) */
import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type HProps = React.HTMLAttributes<HTMLHeadingElement>;

// A container box with a styled border and background
export function Card({ className = "", ...props }: DivProps) {
  return <div className={`admin-card ${className}`.trim()} {...props} />;
}

// Top section of a card, holds a title or actions
export function CardHeader({ className = "", ...props }: DivProps) {
  return <div className={`admin-card-head ${className}`.trim()} {...props} />;
}

// The card's heading text
export function CardTitle({ className = "", ...props }: HProps) {
  return <h3 className={`admin-card-title ${className}`.trim()} {...props} />;
}

// The main body area of a card where content goes
export function CardContent({ className = "", ...props }: DivProps) {
  return <div className={`admin-card-body ${className}`.trim()} {...props} />;
}
