import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink as RouterNavLink } from "react-router-dom";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center px-3.5 h-10 text-sm font-semibold transition rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap";
  const variants: Record<string, string> = {
    primary: "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-md hover:from-blue-500 hover:to-blue-500 active:translate-y-px",
    secondary:
      "bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-50 active:translate-y-px",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 active:translate-y-px",
    danger: "bg-red-600 text-white shadow hover:bg-red-700 active:translate-y-px",
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
    success: "bg-green-50 text-green-800 border border-green-100 shadow-sm",
    error: "bg-red-50 text-red-700 border border-red-100 shadow-sm",
    info: "bg-blue-50 text-blue-800 border border-blue-100 shadow-sm",
  };
  return <div className={`rounded-lg px-3 py-2 text-sm ${styles[type]}`}>{children}</div>;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 rounded-full p-1">✕</button>
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
      {description && <p className="text-sm text-slate-700 mb-4 leading-relaxed">{description}</p>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Bitte warten..." : "Bestätigen"}
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
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const transform = useMemo(
    () => (align === "right" ? "translateX(-100%)" : "translateX(0)"),
    [align]
  );

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        left: align === "right" ? rect.right : rect.left,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        className="cursor-pointer select-none h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        aria-label="Weitere Aktionen"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span className="text-lg leading-none">⋮</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-max bg-white border border-slate-200 rounded shadow z-[9999] p-1 text-sm space-y-1"
            style={{ top: pos.top, left: pos.left, transform }}
            role="menu"
          >
            {items.map((item, idx) => (
              <button
                key={idx}
                className={`w-full inline-flex items-center gap-2 text-left px-2 py-1 rounded hover:bg-slate-100 ${
                  item.danger ? "text-red-600" : ""
                } ${item.disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick();
                }}
                disabled={item.disabled}
                role="menuitem"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
