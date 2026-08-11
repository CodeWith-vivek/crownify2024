export function Footer() {
  return (
    <footer className="mt-auto border-t bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm">
        <p className="font-heading text-lg font-semibold">CROWNIFY</p>
        <p className="mt-1 text-primary-foreground/70">
          Your go-to store for premium headwear.
        </p>
        <p className="mt-4 text-primary-foreground/50">
          &copy; {new Date().getFullYear()} Crownify. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
