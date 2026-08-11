import { Button } from "@/components/ui/button";
import { googleLoginUrl } from "./authApi";

export function GoogleButton({ from = "login" }) {
  return (
    <Button asChild variant="outline" className="w-full">
      <a href={googleLoginUrl(from)}>Continue with Google</a>
    </Button>
  );
}
