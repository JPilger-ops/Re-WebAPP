import React from "react";
import { Link, NavLink as RouterNavLink } from "react-router-dom";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition";
  const variants: Record<string, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70",
    secondary:
      "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 disabled:opacity-70",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-70",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`input ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className ?? ""}`} />;
}

export function Checkbox({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" {...props} />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`input ${props.className ?? ""}`}
    />
  );
}

export function Alert({ type = "info", children }: { type?: "success" | "error" | "info"; children: React.ReactNode; }) {
  const styles: Record<string, string> = {
    success: "bg-green-50 text-green-800 border border-green-100",
    error: "bg-red-50 text-red-700 border border-red-100",
    info: "bg-blue-50 text-blue-800 border border-blue-100",
  };
  return <div className={`rounded-md px-3 py-2 text-sm ${styles[type]}`}>{children}</div>;
}

export function Spinner() {
  return (
    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-600">
      <div className="font-semibold text-slate-800 mb-1">{title}</div>
      {description && <div className="text-sm">{description}</div>}
    </div>
  );
}

export function SidebarLink({
  to,
  label,
  icon,
  onClick,
  collapsed = false,
}: {
  to: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  return (
    <RouterNavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
          isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"
        }`
      }
    >
      {icon}
      <span className={collapsed ? "sr-only" : "block"}>{label}</span>
    </RouterNavLink>
  );
}

export function TopbarUser({ name, role, onLogout }: { name: string; role?: string | null; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-slate-700">
        <div className="font-semibold">{name}</div>
        {role && <div className="text-xs text-slate-500">{role}</div>}
      </div>
      <Button variant="secondary" onClick={onLogout}>Logout</Button>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({
  title,
  description,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      {description && <p className="text-sm text-slate-700 mb-4">{description}</p>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Bitte warten..." : "Löschen"}
        </Button>
      </div>
    </Modal>
  );
}

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "blue" | "amber" }) {
  const map: Record<string, string> = {
    gray: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
    amber: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

type MoreMenuItem = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
};

export function MoreMenu({ items, align = "right" }: { items: MoreMenuItem[]; align?: "left" | "right" }) {
  const closeMenu = (el: HTMLElement | null) => {
    const details = el?.closest("details") as HTMLDetailsElement | null;
    if (details) details.open = false;
  };

  return (
    <details className="relative inline-block">
      <summary
        className="cursor-pointer list-none select-none h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        role="button"
        aria-label="Weitere Aktionen"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const details = (e.currentTarget as HTMLElement).closest("details") as HTMLDetailsElement | null;
            if (details) details.open = !details.open;
          }
        }}
      >
        <span className="text-lg leading-none">⋮</span>
      </summary>
      <div
        className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-2 min-w-[160px] bg-white border border-slate-200 rounded shadow z-20 p-1 text-sm space-y-1`}
      >
        {items.map((item, idx) => (
          <button
            key={idx}
            className={`w-full inline-flex items-center gap-2 text-left px-2 py-1 rounded hover:bg-slate-100 ${
              item.danger ? "text-red-600" : ""
            } ${item.disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (item.disabled) return;
              closeMenu(e.currentTarget);
              item.onClick();
            }}
            disabled={item.disabled}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
