import React from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData, useFetcher, useRouteError } from "react-router";
import { authenticate, ensureAutomaticDiscount } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  await ensureAutomaticDiscount(admin).catch((e) =>
    console.error("[comboloco] loader discount error:", e),
  );
  const bundles = await db.quantityBundle.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, isActive: true, applyTo: true, createdAt: true },
  });
  return { bundles, shop: session.shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("_action") as string;
  const id = formData.get("id") as string;

  if (intent === "edit") {
    return redirect(`/app/bundles/${id}`);
  }

  if (intent === "create") {
    const bundle = await db.quantityBundle.create({
      data: {
        shop: session.shop,
        name: "Nueva oferta",
        tiers: {
          create: [
            { quantity: 1, label: "LLEVA 1",   discountType: "FIXED", discountValue: 10000, isDefault: true,  position: 0 },
            { quantity: 2, label: "LLEVA 2X1", discountType: "FIXED", discountValue: 20000, badge: "Más elegido", etiqueta: "ENVÍO GRATIS", position: 1 },
            { quantity: 3, label: "LLEVA 3",   discountType: "FIXED", discountValue: 30000, badge: "Máximo ahorro", etiqueta: "ENVÍO GRATIS", position: 2 },
          ],
        },
      },
    });
    return redirect(`/app/bundles/${bundle.id}`);
  }

  if (intent === "toggle") {
    const bundle = await db.quantityBundle.findFirst({
      where: { id, shop: session.shop },
      select: { isActive: true },
    });
    if (bundle) {
      await db.quantityBundle.update({ where: { id }, data: { isActive: !bundle.isActive } });
    }
    return null;
  }

  if (intent === "delete") {
    await db.quantityBundle.deleteMany({ where: { id, shop: session.shop } });
    return null;
  }

  return null;
};

type Bundle = Awaited<ReturnType<typeof loader>>["bundles"][number];

const btnStyle = (color = "#374151"): React.CSSProperties => ({
  padding: "8px 16px",
  border: `1.5px solid ${color}`,
  borderRadius: "8px",
  color,
  fontWeight: 600,
  fontSize: "14px",
  textDecoration: "none",
  cursor: "pointer",
  background: "white",
  textAlign: "center",
  minWidth: "100px",
  height: "36px",
});

function BundleRow({ bundle }: { bundle: Bundle }) {
  const toggleFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const editFetcher = useFetcher();

  const isActive = toggleFetcher.state !== "idle" ? !bundle.isActive : bundle.isActive;
  if (deleteFetcher.state !== "idle") return null;

  return (
    <s-box padding="base" border-width="base" border-radius="base">
      <s-stack direction="inline" gap="base">
        <s-stack direction="block" gap="base">
          <s-link href={`/app/bundles/${bundle.id}`}>{bundle.name}</s-link>
          <s-stack direction="inline" gap="base">
            <s-badge tone={bundle.applyTo === "ALL" ? "info" : "neutral"}>
              {bundle.applyTo === "ALL" ? "Todos los productos" : "Producto específico"}
            </s-badge>
            <s-badge tone={isActive ? "success" : "neutral"}>
              {isActive ? "Activo" : "Inactivo"}
            </s-badge>
          </s-stack>
        </s-stack>

        <s-stack direction="inline" gap="base">
          <button style={btnStyle("#374151")} onClick={() => editFetcher.submit({ _action: "edit", id: bundle.id }, { method: "post" })}>
            Editar
          </button>
          <button style={btnStyle()} onClick={() => toggleFetcher.submit({ _action: "toggle", id: bundle.id }, { method: "post" })}>
            {isActive ? "Desactivar" : "Activar"}
          </button>
          <button style={btnStyle("#B91C1C")} onClick={() => deleteFetcher.submit({ _action: "delete", id: bundle.id }, { method: "post" })}>
            Eliminar
          </button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export default function BundleList() {
  const { bundles, shop } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher();


  const handleCreate = () =>
    createFetcher.submit({ _action: "create" }, { method: "post" });

  const themeEditorUrl = `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=13f3dd11-cce6-b53d-ecbe-b5b024b08fced7153848/quantity-break-widget`;

  return (
    <s-page heading="Ofertas">
      {bundles.length > 0 && (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={handleCreate}
          {...(createFetcher.state !== "idle" ? { loading: true } : {})}
        >
          Crear oferta
        </s-button>
      )}

      <s-section heading="Cómo activar el widget en tu tienda">
        <s-stack direction="block" gap="base">
          <s-text>Seguí estos pasos para que el widget de ofertas aparezca en las páginas de producto:</s-text>
          <s-ordered-list>
            <s-list-item>Hacé clic en "Ir al editor de tema" para abrir el editor de Shopify.</s-list-item>
            <s-list-item>En el panel izquierdo, buscá la sección <strong>App embeds</strong> (Aplicaciones integradas).</s-list-item>
            <s-list-item>Activá el toggle de <strong>Quantity Breaks</strong>.</s-list-item>
            <s-list-item>Hacé clic en <strong>Guardar</strong> en el editor de tema.</s-list-item>
            <s-list-item>Volvé aquí y creá tu primera oferta.</s-list-item>
          </s-ordered-list>
          <s-button variant="secondary" onClick={() => window.open(themeEditorUrl, "_blank")}>
            Ir al editor de tema →
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Tus ofertas">
        {bundles.length === 0 ? (
          <s-stack direction="block" gap="base">
            <s-text>
              Todavía no tenés ofertas. Creá tu primera oferta de quantity breaks para empezar a vender más.
            </s-text>
            <s-button
              variant="primary"
              onClick={handleCreate}
              {...(createFetcher.state !== "idle" ? { loading: true } : {})}
            >
              Crear mi primera oferta
            </s-button>
          </s-stack>
        ) : (
          <s-stack direction="block" gap="base">
            {bundles.map((bundle) => (
              <BundleRow key={bundle.id} bundle={bundle} />
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
