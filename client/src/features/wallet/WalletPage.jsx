import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { walletApi } from "./walletApi";
import { useRazorpayScript } from "@/lib/useRazorpayScript";
import { useAuth } from "@/store/AuthContext";

export function WalletPage() {
  const queryClient = useQueryClient();
  const razorpayReady = useRazorpayScript();
  const { refreshMe } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => walletApi.get(),
  });

  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAddMoney = async (e) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!razorpayReady || !window.Razorpay) {
      toast.error("Payment gateway is still loading, please try again");
      return;
    }

    setAdding(true);
    try {
      const res = await walletApi.addMoney(numericAmount);
      if (!res?.success) {
        toast.error(res?.message || "Could not start payment");
        return;
      }

      const rzp = new window.Razorpay({
        key: res.key,
        amount: numericAmount * 100,
        currency: "INR",
        name: "CROWNIFY",
        description: "Add money to wallet",
        order_id: res.orderId,
        handler: async (response) => {
          try {
            const confirmRes = await walletApi.confirmPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              amount: numericAmount,
            });
            if (confirmRes?.success) {
              toast.success("Money added to wallet");
              setAmount("");
              await queryClient.invalidateQueries({ queryKey: ["wallet"] });
              await refreshMe();
            } else {
              toast.error(confirmRes?.message || "Payment verification failed");
            }
          } catch (err) {
            toast.error(err.message || "Payment verification failed");
          }
        },
        theme: { color: "#291616" },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.message || "Could not start payment");
    } finally {
      setAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">
        Could not load your wallet.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="font-heading text-3xl font-bold text-primary">Wallet</h1>

      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">₹{data?.user?.wallet || 0}</p>
          <form onSubmit={handleAddMoney} className="mt-4 flex gap-2">
            <Input type="number" min="1" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button type="submit" disabled={adding}>
              {adding ? "Processing..." : "Add Money"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.transactions?.length ? (
            data.transactions.map((t) => (
              <div key={t._id} className="flex items-center justify-between text-sm">
                <div>
                  <p>{t.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()}</p>
                </div>
                <span className={t.type === "credit" ? "text-green-600" : "text-destructive"}>
                  {t.type === "credit" ? "+" : "-"}₹{t.amount}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
