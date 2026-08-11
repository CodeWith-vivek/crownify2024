export function ComingSoon({ title }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-heading text-3xl font-bold text-primary">{title}</h1>
      <p className="mt-2 text-muted-foreground">This page is being rebuilt in React — coming soon.</p>
    </div>
  );
}
