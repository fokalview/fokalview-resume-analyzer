import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductBrand } from "./BrandFamily";

const LINKS = [
  { href: "/about", label: "About SagittaIQ", detail: "Purpose, audience, and founder story" },
  { href: "/how-it-works", label: "How It Works", detail: "From resume review to workforce insights" },
  { href: "/data-and-privacy", label: "Data and Privacy", detail: "What is collected, retained, and reported" },
  { href: "/product-family", label: "Product Family", detail: "Career, Workforce, Insights, and Connect" }
];

export default function PublicSiteMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div className="public-site-menu">
      <button className="public-menu-button" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls="public-site-navigation">
        {open ? <X size={19} /> : <Menu size={19} />}
        Menu
      </button>
      {open && (
        <nav id="public-site-navigation" className="public-menu-popover" aria-label="SagittaIQ public pages">
          <ProductBrand product="platform" compact />
          <div>
            {LINKS.map((link) => (
              <a key={link.href} href={link.href}>
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
