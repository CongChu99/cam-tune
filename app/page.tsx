import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <h1 className="text-4xl font-bold tracking-tight">CamTune</h1>
      <p className="text-muted-foreground text-lg">
        AI-powered camera settings advisor
      </p>
      {/* shadcn Button — verifies shadcn/ui is correctly configured */}
      <Button size="lg">Get Started</Button>
    </main>
  );
}
