import { notFound } from "next/navigation";
import { DevGateway } from "./DevGateway";

/** LOCAL DEVELOPMENT ONLY: a stand-in for the Razorpay Checkout modal. */
export default async function DevCheckout({ searchParams }: { searchParams: Promise<{ order?: string; ref?: string; amount?: string }> }) {
  if (process.env.DEPLOY_ENV !== "local" || process.env.PAYMENT_PROVIDER !== "fake") notFound();
  const sp = await searchParams;
  if (!sp.order || !sp.ref) notFound();
  return <DevGateway orderId={sp.order} reference={sp.ref} amountPaise={Number(sp.amount ?? 0)} />;
}
