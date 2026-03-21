import { PlaceholderPage } from "@/components/PlaceholderPage";

type Props = { params: Promise<{ orderId: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  return (
    <PlaceholderPage
      screenId="SCR-ORD-DETAIL"
      title={`注文詳細（${orderId}）`}
    />
  );
}
