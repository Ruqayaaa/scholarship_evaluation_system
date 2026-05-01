/* (FigmaMake, 2025) */
import * as React from "react";

// A basic text input field with consistent styling across the app
export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field ${className}`.trim()} {...props} />;
}
