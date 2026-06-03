import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  const { hasActivePayment } = await billing.check({
    plans: ["ComboLoco Pro"],
    isTest: process.env.NODE_ENV !== "production",
  });

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", hasActivePayment };
};

export default function App() {
  const { apiKey, hasActivePayment } = useLoaderData<typeof loader>();

  if (!hasActivePayment) {
    return (
      <AppProvider embedded apiKey={apiKey}>
        <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", fontFamily: "sans-serif", padding: "0 24px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Suscripción requerida</h1>
          <p style={{ color: "#6B7280", marginBottom: 32 }}>
            ComboLoco requiere una suscripción activa para funcionar. Comenzá con 7 días gratis, sin cargo hasta que termine el período de prueba.
          </p>
          <form method="post" action="/app/subscribe">
            <button
              type="submit"
              style={{ background: "#16A34A", color: "white", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
            >
              Activar prueba gratuita →
            </button>
          </form>
        </div>
      </AppProvider>
    );
  }

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Bundles</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
