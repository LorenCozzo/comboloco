import { useState, useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate, useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

type TierState = {
  quantity: number;
  label: string;
  subtitle: string;
  badge: string;
  etiqueta: string;
  discountType: "FIXED" | "PERCENTAGE";
  discountValue: number;
  isDefault: boolean;
  isPopular: boolean;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const bundle = await db.quantityBundle.findFirst({
    where: { id: params.id, shop: session.shop },
    include: { tiers: { orderBy: { position: "asc" } } },
  });
  if (!bundle) throw new Response("Not found", { status: 404 });
  return { bundle };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const existing = await db.quantityBundle.findFirst({
    where: { id: params.id!, shop: session.shop },
    select: { id: true },
  });
  if (!existing) throw new Response("Not found", { status: 404 });

  const formData = await request.formData();
  const tiersData: TierState[] = JSON.parse(formData.get("tiers") as string);

  await db.quantityBundle.update({
    where: { id: params.id! },
    data: {
      name:                        formData.get("name") as string,
      discountName:                (formData.get("discountName") as string) || null,
      widgetTitle:                 formData.get("widgetTitle") as string,
      applyTo:                     formData.get("applyTo") as string,
      productId:                   (formData.get("productId") as string) || null,
      combinesWithProductDiscounts: formData.get("combinesWithProductDiscounts") === "true",
      styleLayout:                 Number(formData.get("styleLayout") ?? 0),
      cornerRadius:                Number(formData.get("cornerRadius") ?? 16),
      spacing:                     Number(formData.get("spacing") ?? 8),
      cardBg:                      formData.get("cardBg") as string,
      selectedBg:                  formData.get("selectedBg") as string,
      borderColor:                 formData.get("borderColor") as string,
      titleColor:                  formData.get("titleColor") as string,
      subtitleColor:               formData.get("subtitleColor") as string,
      priceColor:                  formData.get("priceColor") as string,
      originalPriceColor:          formData.get("originalPriceColor") as string,
      labelBg:                     formData.get("labelBg") as string,
      labelTextColor:              formData.get("labelTextColor") as string,
      badgeBg:                     formData.get("badgeBg") as string,
      badgeTextColor:              formData.get("badgeTextColor") as string,
      fontFamily:                  formData.get("fontFamily") as string,
      timerEnabled:                formData.get("timerEnabled") === "true",
      timerHours:                  Number(formData.get("timerHours") ?? 9),
      timerText:                   formData.get("timerText") as string,
    },
  });

  await db.tier.deleteMany({ where: { bundleId: params.id! } });
  if (tiersData.length > 0) {
    await db.tier.createMany({
      data: tiersData.map((t, i) => ({
        bundleId:     params.id!,
        quantity:     Number(t.quantity),
        label:        t.label,
        subtitle:     t.subtitle || null,
        badge:        t.badge || null,
        etiqueta:     t.etiqueta || null,
        discountType: t.discountType,
        discountValue: Number(t.discountValue),
        isDefault:    Boolean(t.isDefault),
        isPopular:    Boolean(t.isPopular),
        position:     i,
      })),
    });
  }

  const applyTo  = formData.get("applyTo") as string;
  const productId = (formData.get("productId") as string) || null;

  const tiersJson = JSON.stringify(tiersData.map((t, i) => ({
    quantity: Number(t.quantity),
    discountType: t.discountType,
    discountValue: Number(t.discountValue),
    position: i,
  })));

  if (applyTo === "PRODUCT" && productId) {
    await admin.graphql(
      `#graphql
      mutation SetProductMetafield($input: ProductInput!) {
        productUpdate(input: $input) { userErrors { field message } }
      }`,
      {
        variables: {
          input: {
            id: productId,
            metafields: [{
              namespace: "quantity_breaks",
              key: "config",
              value: tiersJson,
              type: "json",
            }],
          },
        },
      },
    );
  }

  // Siempre actualizar el discount node con el mapa completo de todos los bundles activos
  const discountRes = await admin.graphql(`
    #graphql
    query GetDiscount {
      discountNodes(first: 5, query: "title:ComboLoco Quantity Breaks") {
        nodes {
          id
          metafield(namespace: "quantity_breaks", key: "bundle_map") { value }
        }
      }
    }
  `);
  const discountData = await discountRes.json();
  const discountNode = discountData?.data?.discountNodes?.nodes?.[0];
  if (discountNode) {
    // Leer mapa existente y actualizar solo la entrada de este bundle
    let bundleMap: Record<string, unknown> = {};
    try { bundleMap = JSON.parse(discountNode.metafield?.value || "{}"); } catch {}

    const tiersArray = tiersData.map((t, i) => ({
      quantity: Number(t.quantity),
      discountType: t.discountType,
      discountValue: Number(t.discountValue),
      position: i,
    }));

    const mapKey = applyTo === "PRODUCT" && productId ? productId : "ALL";
    bundleMap[mapKey] = tiersArray;

    await admin.graphql(
      `#graphql
      mutation SetDiscountMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          metafields: [{
            ownerId: discountNode.id,
            namespace: "quantity_breaks",
            key: "bundle_map",
            value: JSON.stringify(bundleMap),
            type: "json",
          }],
        },
      },
    );
  }

  return { ok: true };
};

// ——— Preview del widget ———

function WidgetPreview({ bundle, tiers }: {
  bundle: {
    widgetTitle: string; borderColor: string; cardBg: string; selectedBg: string;
    titleColor: string; subtitleColor: string; priceColor: string; originalPriceColor: string;
    labelBg: string; labelTextColor: string; badgeBg: string; badgeTextColor: string;
    fontFamily: string; cornerRadius: number; spacing: number;
    timerEnabled: boolean; timerHours: number; timerText: string; styleLayout: number;
  };
  tiers: TierState[];
}) {
  const [selected, setSelected] = useState(0);
  const [timeLeft, setTimeLeft] = useState(bundle.timerHours * 3600);

  useEffect(() => {
    setSelected(tiers.findIndex((t) => t.isDefault) ?? 0);
  }, [tiers]);

  useEffect(() => {
    if (!bundle.timerEnabled) return;
    setTimeLeft(bundle.timerHours * 3600);
    const iv = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, [bundle.timerEnabled, bundle.timerHours]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const r = `${bundle.cornerRadius}px`;
  const sp = bundle.spacing;
  const isHorizontal = bundle.styleLayout === 1;
  const isCompact = bundle.styleLayout === 2;
const fontSize = isCompact ? 12 : 14;

  const TierCard = ({ tier, i }: { tier: TierState; i: number }) => (
    <div style={{ position: "relative", marginBottom: isHorizontal ? 0 : sp, flex: isHorizontal ? "1" : undefined, marginTop: tier.badge ? 10 : 0 }}>
      {tier.badge && (
        <span style={{
          position: "absolute", top: -14, right: 12,
          background: bundle.badgeBg, color: bundle.badgeTextColor,
          borderRadius: 20,
          padding: "3px 12px",
          fontSize: 12, fontWeight: 700,
          whiteSpace: "nowrap", zIndex: 1,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          letterSpacing: "0.01em",
        }}>
          {tier.badge}
        </span>
      )}
      <div
        onClick={() => setSelected(i)}
        style={{
          display: "flex",
          flexDirection: isHorizontal ? "column" : "row",
          alignItems: isHorizontal ? "flex-start" : "center",
          gap: isHorizontal ? 4 : 10,
          border: `2px solid ${i === selected ? bundle.borderColor : "#E5E7EB"}`,
          borderRadius: r,
          padding: tier.badge ? `18px 20px 14px` : isCompact ? "8px 20px" : "12px 20px",
          cursor: "pointer",
          background: i === selected ? bundle.selectedBg : bundle.cardBg,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0, overflow: "hidden" }}>
          <input type="radio" readOnly checked={i === selected} style={{ margin: 0, accentColor: bundle.borderColor, flexShrink: 0, width: 18, height: 18 }} />
          <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
              <span style={{ fontWeight: 700, fontSize: fontSize + 2, color: bundle.titleColor, whiteSpace: "nowrap", flexShrink: 0 }}>{tier.label || `Llevá ${tier.quantity}`}</span>
              {tier.etiqueta && (
                <span style={{ background: bundle.labelBg, color: bundle.labelTextColor, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {tier.etiqueta}
                </span>
              )}
            </div>
            {tier.subtitle && (
              <div style={{ fontSize: 12, color: bundle.subtitleColor, whiteSpace: "nowrap" }}>{tier.subtitle}</div>
            )}
          </div>
        </div>
        <div style={{ marginLeft: isHorizontal ? 0 : 8, textAlign: isHorizontal ? "left" : "right", flexShrink: 0, lineHeight: 1.2 }}>
          <div style={{ fontWeight: 700, fontSize: fontSize + 2, color: bundle.priceColor }}>
            ${tier.discountValue.toLocaleString("es-AR")}
          </div>
          <div style={{ fontSize: 11, color: bundle.originalPriceColor, textDecoration: "line-through" }}>
            ${(tier.discountValue * 1.3).toLocaleString("es-AR")}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: bundle.fontFamily !== "inherit" ? bundle.fontFamily : "sans-serif", fontSize }}>
      {bundle.timerEnabled && (
        <div style={{ background: "#FEF3C7", borderRadius: r, padding: "8px 14px", marginBottom: sp, textAlign: "center", fontWeight: 600, fontSize: 13 }}>
          🚨 {bundle.timerText} {fmt(timeLeft)}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: `0 0 ${sp}px` }}>
        <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
        <span style={{ fontWeight: 700, fontSize: isCompact ? 12 : 14, color: bundle.titleColor, whiteSpace: "nowrap", letterSpacing: "0.05em" }}>
          {bundle.widgetTitle}
        </span>
        <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
      </div>
      {tiers.length === 0 && <p style={{ color: "#9CA3AF", fontSize: 13 }}>Agregá tiers para ver el preview</p>}
      <div style={{ display: isHorizontal ? "flex" : "block", gap: isHorizontal ? sp : undefined }}>
        {tiers.map((tier, i) => <TierCard key={i} tier={tier} i={i} />)}
      </div>
    </div>
  );
}

// ——— Estilos de inputs ———
const inp: React.CSSProperties = {
  width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB",
  borderRadius: 6, fontSize: 14, boxSizing: "border-box", background: "#fff", fontFamily: "inherit",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#374151",
};
const colorRow = (label: string, value: string, onChange: (v: string) => void) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: 36, height: 32, padding: 2, border: "1px solid #D1D5DB", borderRadius: 6, cursor: "pointer", background: "none" }} />
    <span style={{ fontSize: 13, color: "#374151", flex: 1 }}>{label}</span>
    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{value}</span>
  </div>
);

// ——— Editor principal ———
export default function BundleEditor() {
  const { bundle } = useLoaderData<typeof loader>();
  const saveFetcher = useFetcher<{ ok: boolean }>();
  const navigate = useNavigate();

  // Bundle state
  const [name,         setName]         = useState(bundle.name);
  const [discountName, setDiscountName] = useState(bundle.discountName ?? "");
  const [widgetTitle,  setWidgetTitle]  = useState(bundle.widgetTitle);
  const [applyTo,      setApplyTo]      = useState(bundle.applyTo);
  const [productId,    setProductId]    = useState(bundle.productId ?? "");
  const [productTitle, setProductTitle] = useState("");
  const [combines,     setCombines]     = useState(bundle.combinesWithProductDiscounts);

  // Style state
  const [styleLayout,   setStyleLayout]   = useState(bundle.styleLayout);
  const [cornerRadius,  setCornerRadius]  = useState(bundle.cornerRadius);
  const [spacing,       setSpacing]       = useState(bundle.spacing);

  // Color state
  const [cardBg,             setCardBg]             = useState(bundle.cardBg);
  const [selectedBg,         setSelectedBg]         = useState(bundle.selectedBg);
  const [borderColor,        setBorderColor]        = useState(bundle.borderColor);
  const [titleColor,         setTitleColor]         = useState(bundle.titleColor);
  const [subtitleColor,      setSubtitleColor]      = useState(bundle.subtitleColor);
  const [priceColor,         setPriceColor]         = useState(bundle.priceColor);
  const [originalPriceColor, setOriginalPriceColor] = useState(bundle.originalPriceColor);
  const [labelBg,            setLabelBg]            = useState(bundle.labelBg);
  const [labelTextColor,     setLabelTextColor]     = useState(bundle.labelTextColor);
  const [badgeBg,            setBadgeBg]            = useState(bundle.badgeBg);
  const [badgeTextColor,     setBadgeTextColor]     = useState(bundle.badgeTextColor);

  // Typography + timer
  const [fontFamily,   setFontFamily]   = useState(bundle.fontFamily);
  const [timerEnabled, setTimerEnabled] = useState(bundle.timerEnabled);
  const [timerHours,   setTimerHours]   = useState(bundle.timerHours);
  const [timerText,    setTimerText]    = useState(bundle.timerText);

  // Tiers
  const [tiers, setTiers] = useState<TierState[]>(
    bundle.tiers.map((t) => ({
      quantity:     t.quantity,
      label:        t.label,
      subtitle:     t.subtitle ?? "",
      badge:        t.badge ?? "",
      etiqueta:     t.etiqueta ?? "",
      discountType: t.discountType as "FIXED" | "PERCENTAGE",
      discountValue: t.discountValue,
      isDefault:    t.isDefault,
      isPopular:    t.isPopular,
    })),
  );

  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (saveFetcher.data?.ok) {
      setSavedAt(Date.now());
      const t = setTimeout(() => navigate("/app"), 1500);
      return () => clearTimeout(t);
    }
  }, [saveFetcher.data, navigate]);

  const handleSave = () => {
    saveFetcher.submit(
      {
        name, discountName, widgetTitle, applyTo, productId,
        combinesWithProductDiscounts: String(combines),
        styleLayout: String(styleLayout), cornerRadius: String(cornerRadius), spacing: String(spacing),
        cardBg, selectedBg, borderColor, titleColor, subtitleColor,
        priceColor, originalPriceColor, labelBg, labelTextColor, badgeBg, badgeTextColor,
        fontFamily, timerEnabled: String(timerEnabled), timerHours: String(timerHours), timerText,
        tiers: JSON.stringify(tiers),
      },
      { method: "post" },
    );
  };

  const openResourcePicker = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (window as any).shopify?.resourcePicker({ type: "product", action: "select", multiple: false });
    if (result?.selection?.length > 0) {
      setProductId(result.selection[0].id);
      setProductTitle(result.selection[0].title);
    }
  };

  const addTier = () => setTiers((p) => [...p, {
    quantity: (p[p.length - 1]?.quantity ?? 0) + 1,
    label: "", subtitle: "", badge: "", etiqueta: "",
    discountType: "FIXED", discountValue: (p[p.length - 1]?.discountValue ?? 0) + 10000,
    isDefault: false, isPopular: false,
  }]);

  const removeTier = (i: number) => setTiers((p) => p.filter((_, idx) => idx !== i));
  const updTier = (i: number, f: keyof TierState, v: string | number | boolean) =>
    setTiers((p) => p.map((t, idx) => idx === i ? { ...t, [f]: v } : t));

  const isSaving = saveFetcher.state !== "idle";

  const previewBundle = {
    widgetTitle, borderColor, cardBg, selectedBg, titleColor, subtitleColor,
    priceColor, originalPriceColor, labelBg, labelTextColor, badgeBg, badgeTextColor,
    fontFamily, cornerRadius, spacing, timerEnabled, timerHours, timerText, styleLayout,
  };

  const LAYOUTS = [
    { id: 0, label: "Apilado" },
    { id: 1, label: "Horizontal" },
    { id: 2, label: "Compacto" },
  ];

  const FONTS = [
    { value: "inherit",                      label: "Fuente del tema" },
    { value: "'Inter', sans-serif",          label: "Inter" },
    { value: "'Helvetica Neue', sans-serif", label: "Helvetica Neue" },
    { value: "'Georgia', serif",             label: "Georgia" },
    { value: "'Courier New', monospace",     label: "Courier New" },
  ];

  return (
    <s-page heading={name || "Nueva oferta"}>
      <s-button slot="primary-action" variant="primary" onClick={handleSave}
        {...(isSaving ? { loading: true } : {})}>
        {savedAt ? "✓ Guardado" : "Guardar"}
      </s-button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(360px, 440px)", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ——— Configuración ——— */}
      <s-section heading="Configuración">
        <s-stack direction="block" gap="base">
          <div>
            <label style={lbl}>Nombre (solo visible para vos)</label>
            <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Oferta 2x1 verano" />
          </div>
          <div>
            <label style={lbl}>Nombre del descuento (visible en carrito/checkout)</label>
            <input style={inp} value={discountName} onChange={(e) => setDiscountName(e.target.value)} placeholder="Ej: 2x1 Especial" />
          </div>
          <div>
            <label style={lbl}>Título del bloque</label>
            <input style={inp} value={widgetTitle} onChange={(e) => setWidgetTitle(e.target.value)} placeholder="Elige un paquete y ahorra" />
          </div>
          <div>
            <label style={lbl}>Visibilidad</label>
            <s-stack direction="block" gap="base">
              {[
                { value: "ALL",     label: "Todos los productos" },
                { value: "PRODUCT", label: "Producto específico" },
              ].map((opt) => (
                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                  <input type="radio" name="applyTo" value={opt.value}
                    checked={applyTo === opt.value}
                    onChange={() => setApplyTo(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </s-stack>
          </div>
          {applyTo === "PRODUCT" && (
            <div>
              <label style={lbl}>Producto</label>
              <s-stack direction="inline" gap="base">
                <s-button variant="secondary" onClick={openResourcePicker}>
                  {productId ? "Cambiar producto" : "Seleccionar producto"}
                </s-button>
                {(productTitle || productId) && (
                  <s-text>{productTitle || productId}</s-text>
                )}
              </s-stack>
            </div>
          )}
          <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={combines} onChange={(e) => setCombines(e.target.checked)} />
            Combinar con otros descuentos de producto
          </label>
        </s-stack>
      </s-section>

      {/* ——— Tiers ——— */}
      <s-section heading="Barras de cantidad">
        <s-stack direction="block" gap="base">
          {tiers.length === 0 && <s-text>Sin tiers — agregá uno abajo.</s-text>}
          {tiers.map((tier, i) => (
            <s-box key={i} padding="base" border-width="base" border-radius="base">
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" gap="base">
                  <s-text>{`Barra #${i + 1} — ${tier.label || `${tier.quantity} unid.`}`}</s-text>
                  <s-button variant="secondary" tone="critical" onClick={() => removeTier(i)}>Eliminar</s-button>
                </s-stack>

                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={lbl}>Cantidad</label>
                    <input style={inp} type="number" min={1} value={tier.quantity}
                      onChange={(e) => updTier(i, "quantity", Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={lbl}>Título</label>
                    <input style={inp} value={tier.label} onChange={(e) => updTier(i, "label", e.target.value)} placeholder="LLEVA 1" />
                  </div>
                  <div>
                    <label style={lbl}>Subtítulo</label>
                    <input style={inp} value={tier.subtitle} onChange={(e) => updTier(i, "subtitle", e.target.value)} placeholder="Opcional" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={lbl}>Tipo de precio</label>
                    <select style={{ ...inp, height: 36 }} value={tier.discountType}
                      onChange={(e) => updTier(i, "discountType", e.target.value)}>
                      <option value="FIXED">Específico (precio total)</option>
                      <option value="PERCENTAGE">Porcentaje de descuento (%)</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>{tier.discountType === "FIXED" ? "Precio total" : "% de descuento"}</label>
                    <input style={inp} type="number" min={0}
                      step={tier.discountType === "FIXED" ? 100 : 1}
                      value={tier.discountValue === 0 ? "" : tier.discountValue}
                      placeholder="0"
                      onChange={(e) => updTier(i, "discountValue", e.target.value === "" ? 0 : Number(e.target.value))} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={lbl}>Etiqueta (pill interna)</label>
                    <input style={inp} value={tier.etiqueta} onChange={(e) => updTier(i, "etiqueta", e.target.value)} placeholder="ENVÍO GRÁTIS" />
                  </div>
                  <div>
                    <label style={lbl}>Badge</label>
                    <input style={inp} value={tier.badge} onChange={(e) => updTier(i, "badge", e.target.value)} placeholder="Más elegido" />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={tier.isDefault}
                        onChange={(e) => {
                          // solo uno puede ser default
                          setTiers((p) => p.map((t, idx) => ({ ...t, isDefault: idx === i ? e.target.checked : false })));
                        }} />
                      Seleccionado por defecto
                    </label>
                  </div>
                </div>

              </s-stack>
            </s-box>
          ))}
          <s-button variant="secondary" onClick={addTier}>+ Agregar barra</s-button>
        </s-stack>
      </s-section>

      {/* ——— Estilo ——— */}
      <s-section heading="Estilo">
        <s-stack direction="block" gap="base">
          <div>
            <label style={lbl}>Diseño</label>
            <div style={{ display: "flex", gap: 8 }}>
              {LAYOUTS.map((l) => (
                <div key={l.id} onClick={() => setStyleLayout(l.id)}
                  style={{
                    border: `2px solid ${styleLayout === l.id ? borderColor : "#D1D5DB"}`,
                    borderRadius: 8, padding: "8px 16px", cursor: "pointer",
                    background: styleLayout === l.id ? selectedBg : "#fff",
                    fontSize: 13, fontWeight: styleLayout === l.id ? 600 : 400,
                  }}>
                  {l.label}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={lbl}>Radio de esquinas: {cornerRadius}px</label>
              <input type="range" min={0} max={24} value={cornerRadius} style={{ width: "100%" }}
                onChange={(e) => setCornerRadius(Number(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>Espaciado: {spacing}px</label>
              <input type="range" min={0} max={40} value={spacing} style={{ width: "100%" }}
                onChange={(e) => setSpacing(Number(e.target.value))} />
            </div>
          </div>
        </s-stack>
      </s-section>

      {/* ——— Colores ——— */}
      <s-section heading="Colores">
        <s-stack direction="block" gap="base">
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>General</p>
            {colorRow("Fondo de las tarjetas",   cardBg,        setCardBg)}
            {colorRow("Fondo seleccionado",       selectedBg,    setSelectedBg)}
            {colorRow("Color del borde",          borderColor,   setBorderColor)}
            {colorRow("Título del bloque",        titleColor,    setTitleColor)}
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Textos de barra</p>
            {colorRow("Título",         titleColor,         setTitleColor)}
            {colorRow("Subtítulo",      subtitleColor,      setSubtitleColor)}
            {colorRow("Precio",         priceColor,         setPriceColor)}
            {colorRow("Precio completo", originalPriceColor, setOriginalPriceColor)}
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Etiqueta</p>
            {colorRow("Fondo",  labelBg,        setLabelBg)}
            {colorRow("Texto",  labelTextColor, setLabelTextColor)}
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Badge</p>
            {colorRow("Fondo", badgeBg,        setBadgeBg)}
            {colorRow("Texto", badgeTextColor, setBadgeTextColor)}
          </div>
        </s-stack>
      </s-section>

      {/* ——— Tipografía ——— */}
      <s-section heading="Tipografía">
        <div>
          <label style={lbl}>Fuente</label>
          <select style={{ ...inp, height: 36 }} value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
            {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </s-section>

      {/* ——— Timer ——— */}
      <s-section heading="Timer de urgencia">
        <s-stack direction="block" gap="base">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} />
            Activar countdown timer
          </label>
          {timerEnabled && (
            <>
              <div>
                <label style={lbl}>Horas del countdown</label>
                <input style={{ ...inp, width: 120 }} type="number" min={1} max={48} value={timerHours}
                  onChange={(e) => setTimerHours(Number(e.target.value))} />
              </div>
              <div>
                <label style={lbl}>Texto del timer</label>
                <input style={inp} value={timerText} onChange={(e) => setTimerText(e.target.value)} />
              </div>
            </>
          )}
        </s-stack>
      </s-section>

      </div> {/* cierre left column */}

      <div style={{ position: "sticky", top: 16 }}>
        <s-section heading="Preview">
          <WidgetPreview bundle={previewBundle} tiers={tiers} />
        </s-section>
      </div>

      </div> {/* cierre grid */}
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
