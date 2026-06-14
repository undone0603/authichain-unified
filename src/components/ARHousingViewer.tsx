'use client';

interface Props {
  projectName: string;
}

export default function ARHousingViewer({ projectName }: Props) {
  return (
    <div className="aspect-video bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-600 text-sm font-mono">
      WebXR — {projectName}
    </div>
  );
}
