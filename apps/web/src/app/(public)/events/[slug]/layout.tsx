import { EmergencyBanner } from '@/components/shared/EmergencyBanner';

export default async function PublicEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  // We don't have eventId directly in the path (it's slug), but let's assume slug works as eventId or we need to lookup eventId.
  // Actually, the locofoot structure uses slug = event_id in many places, let's use slug as eventId.
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <EmergencyBanner eventId={slug} />
      {children}
    </div>
  );
}
