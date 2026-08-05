import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Outlet,
  useLoaderData,
  useNavigation,
  useRouteError,
  useSubmit,
} from "react-router";
import { boundary, BillingInterval } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  PLAN_NAME,
  PLAN_PRICE,
  TRIAL_DAYS,
  COMMUNITY_PROMO_CODE,
  COMMUNITY_PROMO_DISCOUNT,
  normalizePromo,
  isValidPromo,
  discountedMonthlyPrice,
  formatUsd,
} from "../billing.shared";

// How long we trust a locally-recorded "active" billing status before asking
// Shopify again. Keeps every non-billing navigation (e.g. leaving to the
// theme editor and back) from racing Shopify's own read-after-write lag on
// the subscription, which was causing a repeated replace-subscription loop.
const BILLING_RECHECK_MS = 24 * 60 * 60 * 1000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, admin, session } = await authenticate.admin(request);

  const shopRes = await admin.graphql(`#graphql
    query ShopPlan {
      shop {
        plan {
          partnerDevelopment
        }
      }
    }
  `);
  const shopData = await shopRes.json();
  const isTest = shopData?.data?.shop?.plan?.partnerDevelopment ?? false;

  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  const url = new URL(request.url);
  const rawPromo = url.searchParams.get("promo");
  const wantsSubscribe = url.searchParams.get("subscribe") === "1";
  const chargeId = url.searchParams.get("charge_id");
  // App Bridge context — forwarded through the paywall form so it survives the
  // subscribe navigation.
  const host = url.searchParams.get("host") ?? "";

  const billingRecord = await prisma.shopBilling.findUnique({
    where: { shop: session.shop },
  });
  const isRecentlyVerified =
    !!billingRecord?.isActive &&
    Date.now() - billingRecord.checkedAt.getTime() < BILLING_RECHECK_MS;

  // ——— Determine whether the shop currently has an active subscription ———
  let active: boolean;
  if (chargeId) {
    // Just returned from approving/declining a charge. Query the specific
    // charge by id (a direct node lookup, not the eventually-consistent
    // activeSubscriptions list) so we don't hit the read-after-write race.
    const chargeRes = await admin.graphql(
      `#graphql
        query AppSubscriptionStatus($id: ID!) {
          node(id: $id) {
            ... on AppSubscription {
              status
            }
          }
        }
      `,
      { variables: { id: `gid://shopify/AppSubscription/${chargeId}` } },
    );
    const chargeData = await chargeRes.json();
    active = chargeData?.data?.node?.status === "ACTIVE";
    await prisma.shopBilling.upsert({
      where: { shop: session.shop },
      create: { shop: session.shop, isActive: active },
      update: { isActive: active, checkedAt: new Date() },
    });
  } else if (isRecentlyVerified) {
    active = true;
  } else {
    const { hasActivePayment } = await billing.check({
      plans: [PLAN_NAME],
      isTest,
    });
    active = hasActivePayment;
    await prisma.shopBilling.upsert({
      where: { shop: session.shop },
      create: { shop: session.shop, isActive: active },
      update: { isActive: active, checkedAt: new Date() },
    });
  }

  if (active) {
    return {
      apiKey,
      needsSubscription: false,
      host,
      initialPromo: "",
      promoApplied: false,
      promoError: null as string | null,
    };
  }

  // ——— No active subscription: show the paywall (not an automatic charge) ———
  if (wantsSubscribe) {
    // The merchant explicitly clicked "start trial". If they typed a non-empty
    // code that isn't valid, bounce them back with an error rather than
    // silently charging full price.
    if (rawPromo && rawPromo.trim() && !isValidPromo(rawPromo)) {
      return {
        apiKey,
        needsSubscription: true,
        host,
        initialPromo: rawPromo.trim(),
        promoApplied: false,
        promoError: "Ese código no es válido." as string | null,
      };
    }

    const applyPromo = isValidPromo(rawPromo);
    await billing.request({
      plan: PLAN_NAME,
      isTest,
      ...(applyPromo
        ? {
            lineItems: [
              {
                interval: BillingInterval.Every30Days,
                discount: {
                  value: { percentage: COMMUNITY_PROMO_DISCOUNT },
                },
              },
            ],
          }
        : {}),
    });
    // billing.request throws a redirect to Shopify's charge-approval page, so
    // execution never continues past this point.
  }

  return {
    apiKey,
    needsSubscription: true,
    host,
    initialPromo: normalizePromo(rawPromo),
    promoApplied: isValidPromo(rawPromo),
    promoError: null as string | null,
  };
};

export default function App() {
  const data = useLoaderData<typeof loader>();

  if (data.needsSubscription) {
    return (
      <AppProvider embedded apiKey={data.apiKey}>
        <Paywall
          host={data.host}
          initialPromo={data.initialPromo}
          promoApplied={data.promoApplied}
          promoError={data.promoError}
        />
      </AppProvider>
    );
  }

  return (
    <AppProvider embedded apiKey={data.apiKey}>
      <s-app-nav>
        <s-link href="/app">Bundles</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

function Paywall({
  host,
  initialPromo,
  promoApplied,
  promoError,
}: {
  host: string;
  initialPromo: string;
  promoApplied: boolean;
  promoError: string | null;
}) {
  const submit = useSubmit();
  const navigation = useNavigation();
  const [promo, setPromo] = useState(initialPromo);
  const submitting = navigation.state !== "idle";

  const fullPrice = formatUsd(PLAN_PRICE);
  const discounted = formatUsd(discountedMonthlyPrice());

  // Submit the promo straight from React state (rather than relying on the
  // web component participating in native form serialization) so the code is
  // guaranteed to reach the loader, where the discount is applied.
  const startTrial = () => {
    const params = new URLSearchParams({ subscribe: "1" });
    const trimmed = promo.trim();
    if (trimmed) params.set("promo", trimmed);
    if (host) params.set("host", host);
    submit(params, { method: "get", action: "/app" });
  };

  return (
    <s-page heading="Activá ComboLoco">
      <s-section heading="Plan ComboLoco Pro">
        <s-stack direction="block" gap="base">
          <s-text>
            {TRIAL_DAYS} días de prueba gratis. Después {fullPrice}/mes. Cancelás
            cuando quieras.
          </s-text>

          {promoApplied && (
            <s-banner tone="success" heading="Código aplicado">
              <s-text>
                Código {COMMUNITY_PROMO_CODE}: 25% de descuento — pagás{" "}
                {discounted}/mes.
              </s-text>
            </s-banner>
          )}

          {promoError && (
            <s-banner tone="critical" heading="Código inválido">
              <s-text>{promoError}</s-text>
            </s-banner>
          )}

          <s-text-field
            name="promo"
            label="Código de comunidad (opcional)"
            value={promo}
            onChange={(e) => setPromo(e.currentTarget.value)}
            autocomplete="off"
          ></s-text-field>
          <s-button
            variant="primary"
            onClick={startTrial}
            {...(submitting ? { loading: true } : {})}
          >
            Empezar prueba gratis
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
