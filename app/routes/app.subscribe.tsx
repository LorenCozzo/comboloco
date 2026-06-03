import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  await billing.request({
    plan: "ComboLoco Pro",
    isTest: process.env.NODE_ENV !== "production",
    returnUrl: process.env.SHOPIFY_APP_URL,
  });
};
