import { Link } from "react-router-dom";
import { Package, MapPin, Wallet, UserCog } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/store/AuthContext";

const links = [
  { to: "/AccountDetails", label: "Account Details", icon: UserCog, description: "Update your name, phone, and password" },
  { to: "/orders", label: "Orders", icon: Package, description: "Track and manage your orders" },
  { to: "/Address", label: "Addresses", icon: MapPin, description: "Manage your shipping addresses" },
  { to: "/wallet", label: "Wallet", icon: Wallet, description: "View balance and add money" },
];

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Hi, {user?.name?.split(" ")[0]}</h1>
      <p className="mt-1 text-muted-foreground">{user?.email}</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {links.map(({ to, label, icon: Icon, description }) => (
          <Link key={to} to={to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-6">
                <Icon className="h-8 w-8 text-accent" />
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
