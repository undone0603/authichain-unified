type Props = {
  name: string;
  price: string;
  features: string[];
};

export function PricingCard({ name, price, features }: Props) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-xl font-semibold">{name}</h3>
      <p className="mt-2 text-3xl font-semibold text-cyan-300">{price}</p>
      <ul className="mt-4 space-y-2 text-zinc-300">
        {features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>
    </article>
  );
}
