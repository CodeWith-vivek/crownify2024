import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { profileApi } from "./profileApi";
import { useAuth } from "@/store/AuthContext";

export function AccountDetailsPage() {
  const { refreshMe } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["accountDetails"],
    queryFn: profileApi.accountDetails,
  });

  const [details, setDetails] = useState({ name: "", phone: "" });
  const [savingDetails, setSavingDetails] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ password: "", npassword: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (data?.user) {
      setDetails({ name: data.user.name || "", phone: data.user.phone || "" });
    }
  }, [data]);

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setSavingDetails(true);
    try {
      const res = await profileApi.updateUser(details);
      if (res?.success) {
        toast.success("Details updated");
        await refreshMe();
      } else {
        toast.error(res?.error || "Could not update details");
      }
    } catch (err) {
      toast.error(err.message || "Could not update details");
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.npassword !== passwordForm.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await profileApi.updateUser({
        password: passwordForm.password,
        npassword: passwordForm.npassword,
      });
      if (res?.success) {
        toast.success("Password updated");
        setPasswordForm({ password: "", npassword: "", confirm: "" });
      } else {
        toast.error(res?.error || "Could not update password");
      }
    } catch (err) {
      toast.error(err.message || "Could not update password");
    } finally {
      setSavingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="font-heading text-3xl font-bold text-primary">Account Details</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={data?.user?.email || ""} disabled />
            </div>
            <Button type="submit" disabled={savingDetails}>
              {savingDetails ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                required
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newpw">New password</Label>
              <Input
                id="newpw"
                type="password"
                required
                value={passwordForm.npassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, npassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmpw">Confirm new password</Label>
              <Input
                id="confirmpw"
                type="password"
                required
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
