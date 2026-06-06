import { Compass, Orbit, Route, TrendingUp } from "lucide-react";

export type SagittaProduct = "platform" | "career" | "workforce" | "insights" | "connect";

const PRODUCT_COPY: Record<SagittaProduct, { name: string; description: string }> = {
  platform: {
    name: "SagittaIQ",
    description: "Career and workforce intelligence"
  },
  career: {
    name: "Career",
    description: "Readiness, resumes, and opportunities"
  },
  workforce: {
    name: "Workforce",
    description: "Advisor workflows and participant progress"
  },
  insights: {
    name: "Insights",
    description: "Institutional reporting and outcomes"
  },
  connect: {
    name: "Connect",
    description: "Follow-ups, integrations, and verification"
  }
};

export function ProductBrand({
  product,
  inverse = false,
  compact = false
}: {
  product: SagittaProduct;
  inverse?: boolean;
  compact?: boolean;
}) {
  const copy = PRODUCT_COPY[product];

  return (
    <div className={`product-brand product-brand-${product}${inverse ? " inverse" : ""}${compact ? " compact" : ""}`}>
      <BrandMark product={product} />
      <div>
        <strong>
          <span>Sagitta</span><b>IQ</b>
        </strong>
        {product !== "platform" && <em>{copy.name}</em>}
        {!compact && <small>{copy.description}</small>}
      </div>
    </div>
  );
}

export function BrandMark({ product }: { product: SagittaProduct }) {
  const Icon = product === "career"
    ? Route
    : product === "workforce"
      ? Compass
      : product === "insights"
        ? TrendingUp
        : product === "connect"
          ? Orbit
          : Compass;

  return (
    <span className={`suite-mark suite-mark-${product}`} aria-hidden="true">
      <Icon size={24} />
      <i />
    </span>
  );
}

export function ProductFamilyGrid() {
  return (
    <div className="product-family-grid">
      {(["career", "workforce", "insights", "connect"] as SagittaProduct[]).map((product) => (
        <article key={product}>
          <ProductBrand product={product} compact />
          <p>{PRODUCT_COPY[product].description}</p>
        </article>
      ))}
    </div>
  );
}
