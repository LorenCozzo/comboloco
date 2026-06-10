import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary, BillingInterval } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

const COMMUNITY_PROMO_CODE = "ECOMMSYSTEM25";
const COMMUNITY_PROMO_DISCOUNT = 0.25;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, admin } = await authenticate.admin(request);

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

  // Just returned from approving/declining a charge: skip the check on this
  // request to avoid re-requesting billing before Shopify finishes marking
  // the subscription as active (which causes a replace-subscription loop).
  const justReturnedFromBilling = url.searchParams.has("charge_id");

  if (!justReturnedFromBilling) {
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
