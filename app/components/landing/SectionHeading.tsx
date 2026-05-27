type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeading({ eyebrow, title, description, align = "left" }: Props) {
  const alignClass = align === "center" ? "text-center items-center" : "text-left items-start";

  return (
    <div className={`flex flex-col gap-3 ${alignClass}`}>
      {eyebrow ? <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">{eyebrow}</p> : null}
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {description ? <p className="max-w-2xl text-zinc-300">{description}</p> : null}
    </div>
  );
}
