import { Metadata } from "next";
import VideoStudio from "@/components/VideoStudio";

export const metadata: Metadata = {
  title: "AI Video Studio | AuthiChain",
  description: "Generate cinematic AI video reveals for your authenticated products.",
};

export default function VideoStudioPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <VideoStudio />
    </div>
  );
}
