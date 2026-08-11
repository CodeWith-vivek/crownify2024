import { Link } from "react-router-dom";
import { ShoppingBag, Heart, User } from "lucide-react";
import { useAuth } from "@/store/AuthContext";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, cartCount, wishlistCount } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link to="/" className="font-heading text-2xl font-bold tracking-wide text-primary">
          CROWNIFY
        </Link>

        <nav className="hidden gap-6 text-sm font-medium md:flex">
          <Link to="/" className="hover:text-accent">Home</Link>
          <Link to="/brand" className="hover:text-accent">Brand</Link>
          <Link to="/shop" className="hover:text-accent">Shop</Link>
          <Link to="/About" className="hover:text-accent">About</Link>
          <Link to="/contact" className="hover:text-accent">Contact</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/wishlist" className="relative">
            <Heart className="h-5 w-5" />
            {wishlistCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-foreground">
                {wishlistCount}
              </span>
            )}
          </Link>
          <Link to="/cart" className="relative">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-foreground">
                {cartCount}
              </span>
            )}
          </Link>
          {user ? (
            <Link to="/profile">
              <User className="h-5 w-5" />
            </Link>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
