import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Compliance webhook: ${topic} for ${shop}`);

  if (topic === "SHOP_REDACT") {
    await db.quantityBundle.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });
  }

  // customers/data_request and customers/redact: we don't store personal customer data
  return new Response();
};
