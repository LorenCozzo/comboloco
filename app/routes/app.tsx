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

  // Just returned from approving/declining a charge. We still need to know
  // which one happened: querying the specific charge by id is a direct
  // node lookup (not the eventually-consistent activeSubscriptions list),
  // so it doesn't reintroduce the read-after-write race that made us skip
  // billing.require here in the first place.
  const chargeId = url.searchParams.get("charge_id");

  const billingRecord = await prisma.shopBilling.findUnique({
    where: { shop: session.shop },
  });
  const isRecentlyVerified =
    !!billingRecord?.isActive &&
    Date.now() - billingRecord.checkedAt.getTime() < BILLING_RECHECK_MS;

  if (chargeId) {
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
    const status = chargeData?.data?.node?.status;
    const isActive = status === "ACTIVE";

    await prisma.shopBilling.upsert({
      where: { shop: session.shop },
      create: { shop: session.shop, isActive },
      update: { isActive, checkedAt: new Date() },
    });

    if (!isActive) {
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
    }
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
