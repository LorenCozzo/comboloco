import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import {
  PLAN_NAME,
  PLAN_PRICE,
  PLAN_CURRENCY,
  TRIAL_DAYS,
} from "./billing.shared";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma) as any,
  distribution: AppDistribution.AppStore,
  billing: {
    [PLAN_NAME]: {
      lineItems: [
        {
          amount: PLAN_PRICE,
          currencyCode: PLAN_CURRENCY,
          interval: BillingInterval.Every30Days,
        },
      ],
      trialDays: TRIAL_DAYS,
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ admin }) => {
      await ensureAutomaticDiscount(admin);
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAutomaticDiscount(admin: any) {
  try {
    // Buscar si ya existe un discount con nuestra function
    const fnRes = await admin.graphql(`
      #graphql
      query GetFunctions {
        shopifyFunctions(first: 25) {
          nodes { id apiType title }
        }
      }
    `);
    const fnData = await fnRes.json();
    console.log("[comboloco] shopifyFunctions:", JSON.stringify(fnData?.data?.shopifyFunctions?.nodes));
    const fn = fnData?.data?.shopifyFunctions?.nodes?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n: any) => n.apiType === "product_discounts" && n.title === "quantity-break-function"
    );
    if (!fn) {
      console.log("[comboloco] Function not found — deploy the app first");
      return { error: "function_not_found" };
    }

    // Verificar si ya existe un discount para esta función
    const existingRes = await admin.graphql(`
      #graphql
      query GetDiscounts {
        discountNodes(first: 25, query: "title:ComboLoco Quantity Breaks") {
          nodes {
            id
            discount {
              __typename
            }
          }
        }
      }
    `);
    const existingData = await existingRes.json();
    const alreadyExists = (existingData?.data?.discountNodes?.nodes?.length ?? 0) > 0;
    if (alreadyExists) {
      console.log("[comboloco] Automatic discount already exists");
      return { ok: true };
    }

    // Crear el discount automático
    const createRes = await admin.graphql(`
      #graphql
      mutation CreateDiscount($discount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $discount) {
          automaticAppDiscount { discountId }
          userErrors { field message }
        }
      }
    `, {
      variables: {
        discount: {
          title: "ComboLoco Quantity Breaks",
          functionId: fn.id,
          startsAt: new Date().toISOString(),
          combinesWith: {
            orderDiscounts: true,
            shippingDiscounts: true,
            productDiscounts: false,
          },
        },
      },
    });
    const createData = await createRes.json();
    console.log("[comboloco] discountAutomaticAppCreate:", JSON.stringify(createData?.data?.discountAutomaticAppCreate));
    return createData?.data?.discountAutomaticAppCreate;
  } catch (e) {
    console.error("[comboloco] ensureAutomaticDiscount error:", e);
    throw e;
  }
}

export default shopify;
export { ensureAutomaticDiscount };
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
