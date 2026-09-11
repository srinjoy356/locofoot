import QuickMatchForm from "@/components/quick-match/QuickMatchForm";

export const metadata = {
  title: "Start Quick Match · LocoFoot",
};

export default function QuickMatchPage() {
  return (
    <div className="w-full min-h-screen bg-surface">
      <QuickMatchForm />
    </div>
  );
}
