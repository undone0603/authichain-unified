'use client';

<<<<<<< HEAD
interface Props {
  projectName: string;
}

export default function ARHousingViewer({ projectName }: Props) {
  return (
    <div className="aspect-video bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-600 text-sm font-mono">
      WebXR — {projectName}
=======
export default function ARHousingViewer() {
  return (
    <div className="w-full h-64 bg-zinc-900 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 text-sm">
      AR Housing Viewer — coming soon
>>>>>>> origin/add-agentz-editable
    </div>
  );
}
