import { Separator } from "@/components/ui/separator";

type Props = {
  number: string;
  heading: string;
  children: React.ReactNode;
};

export function MarketingSection({ number, heading, children }: Props) {
  return (
    <>
      <Separator />
      <section className="grid gap-8 py-16 md:grid-cols-[200px_1fr] md:gap-20 md:py-20">
        <div>
          <span className="font-mono text-xs uppercase text-muted-foreground">{number}</span>
          <h2 className="mt-2 font-serif text-2xl leading-snug text-foreground md:text-3xl">
            {heading}
          </h2>
        </div>
        <div>{children}</div>
      </section>
    </>
  );
}
