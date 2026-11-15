import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductBrand } from "./BrandFamily";

const LINKS = [
  { href: "/waitlist", label: "Waitlist", detail: "Join the waitlist for early access" },
  { href: "/about", label: "About SagittaIQ", detail: "Purpose, audience, and founder story" },
  { href: "/how-it-works", label: "How It Works", detail: "From resume review to workforce insights" },
  { href: "/data-and-privacy", label: "Data and Privacy", detail: "What is collected, retained, and reported" },
  { href: "/product-family", label: "Product Family", detail: "Career, Workforce, Insights, and Connect" },
  { href: "/admin", label: "Admin", detail: "Sign in to the administrator workspace" }
];

export default function PublicSiteMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (menuRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

  return (
    <div className="public-site-menu" ref={menuRef}>
      <button ref={buttonRef} className="public-menu-button" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls="public-site-navigation">
        {open ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
        Menu
      </button>
      {open && (
        <nav id="public-site-navigation" className="public-menu-popover" aria-label="SagittaIQ public pages">
          <ProductBrand product="platform" compact />
          <div>
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} className={link.href === "/waitlist" ? "public-menu-waitlist" : undefined} aria-current={window.location.pathname === link.href ? "page" : undefined}>
                <strong>{link.label}</strong>
                <span>{link.detail}</span>
              </a>
            ))}
          </div>
          <a className="public-menu-access" href="/">Enter SagittaIQ Career</a>
        </nav>
      )}
    </div>
  );
}
