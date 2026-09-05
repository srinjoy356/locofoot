import { createClient } from "@/lib/supabase/server";

type EventLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: EventLayoutProps) {
  const { slug } = await params;
  const supabase = await createClient();
  
  let eventData = null;
  if (slug.length < 30) {
    const { data } = await supabase.from('events').select('name, description').eq('slug', slug).maybeSingle();
    eventData = data;
  } else {
    const { data } = await supabase.from('events').select('name, description').eq('id', slug).maybeSingle();
    eventData = data;
  }

  const title = eventData ? `${eventData.name} · LocoFoot` : 'Event · LocoFoot';
  const description = eventData?.description || 'View event details, matches, and standings on LocoFoot.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function EventLayout({ children }: EventLayoutProps) {
  return children;
}
