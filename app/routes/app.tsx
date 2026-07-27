import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary, BillingInterval } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const COMMUNITY_PROMO_CODE = "ECOMMSYSTEM25";
const COMMUNITY_PROMO_DISCOUNT = 0.25;

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

  const url = new URL(request.url);
  const promoCode = url.searchParams.get("promo")?.trim().toUpperCase();
  const hasCommunityPromo = promoCode === COMMUNITY_PROMO_CODE;

  // Just returned from approving/declining a charge: trust Shopify's own
  // redirect rather than re-querying immediately (the subscription may not
  // be marked active on Shopify's side yet).
  const justReturnedFromBilling = url.searchParams.has("charge_id");

  const billingRecord = await prisma.shopBilling.findUnique({
    where: { shop: session.shop },
  });
  const isRecentlyVerified =
    !!billingRecord?.isActive &&
    Date.now() - billingRecord.checkedAt.getTime() < BILLING_RECHECK_MS;

  if (justReturnedFromBilling) {
    await prisma.shopBilling.upsert({
      where: { shop: session.shop },
      create: { shop: session.shop, isActive: true },
      update: { isActive: true, checkedAt: new Date() },
    });
  } else if (!isRecentlyVerified) {
    await billing.require({
      plans: ["ComboLoco Pro"],
      isTest,
      onFailure: async () =>
        billing.request({
          plan: "ComboLoco Pro",
          isTest,
          ...(hasCommunityPromo
            ? {
                lineItems: [
                  {
                    interval: BillingInterval.Every30Days,
                    discount: { value: { percentage: COMMUNITY_PROMO_DISCOUNT } },
                  },
                ],
              }
            : {}),
        }),
    });

    // billing.require throws (redirecting to onFailure) when there's no
    // active subscription, so reaching this line means it's active.
    await prisma.shopBilling.upsert({
      where: { shop: session.shop },
      create: { shop: session.shop, isActive: true },
      update: { isActive: true, checkedAt: new Date() },
    });
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

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
