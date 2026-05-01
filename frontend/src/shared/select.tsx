/* (FigmaMake, 2025) */
import * as React from "react";

type SelectCtx = { value: string; setValue: (v: string) => void };
const Ctx = React.createContext<SelectCtx | null>(null);

//  component that holds the selected value 
export function Select({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) {
  return <Ctx.Provider value={{ value, setValue: onValueChange }}>{children}</Ctx.Provider>;
}

// Wrapper retained for API compatibility 
export function SelectTrigger({ children }: { className?: string; children?: React.ReactNode }) {
  return <>{children}</>;
}

// Placeholder component, kept for API compatibility
export function SelectValue(_: { placeholder?: string }) {
  return null;
}

// Renders the actual dropdown by collecting SelectItem children and turning them into <option> elements
export function SelectContent({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  const options: Array<{ value: string; label: React.ReactNode }> = [];
  React.Children.forEach(children, (child: any) => {
    if (child?.props?.value !== undefined) options.push({ value: child.props.value, label: child.props.children });
  });
  return (
    <select className="field admin-select" value={ctx.value} onChange={(e) => ctx.setValue(e.target.value)}>
      {options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Represents a single option in the dropdown, collected by SelectContent at render time
export function SelectItem({ children }: { value: string; children: React.ReactNode }) {
  return <>{children}</>;
}
