import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { walletApi } from "./walletApi";
import { useRazorpayScript } from "@/lib/useRazorpayScript";
import { useAuth } from "@/store/AuthContext";
import { PageError } from "@/components/layout/PageError";

export function WalletPage() {
  usePageAssets("user", "headerwallet", userProfiles);

  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const queryClient = useQueryClient();
  const razorpayReady = useRazorpayScript();
  const { refreshMe } = useAuth();

  const { data, isError, refetch } = useQuery({
    queryKey: ["wallet", page],
    queryFn: () => walletApi.get(page, 5),
  });

  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["wallet"] });

  const submitAmount = async (numericAmount) => {
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Please enter a valid amount.");
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
        toast.error(res?.message || "Something went wrong.");
        return;
      }
      const rzp = new window.Razorpay({
        key: res.key,
        amount: numericAmount * 100,
        currency: "INR",
        name: "CROWNIFY",
        description: "Add to Wallet",
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
              toast.success(confirmRes.message || "Money added successfully");
              setAmount("");
              await refresh();
              await refreshMe();
            } else {
              toast.error(confirmRes?.message || "Payment confirmation failed");
            }
          } catch (err) {
            toast.error("An error occurred while confirming the payment. Please try again.");
          }
        },
        theme: { color: "#F37254" },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitAmount(Number(amount));
  };

  const quickAdd = (value) => {
    setAmount(String(value));
    submitAmount(value);
  };

  const user = data?.user;
  const transactions = data?.transactions || [];
  const currentPage = data?.currentPage || page;
  const totalPages = data?.totalPages || 1;

  // A failed request must not render as a ₹0.00 balance with no transactions.
  if (isError) {
    return <PageError title="Couldn't load your wallet" message="We couldn't reach the server. Your balance and transactions are safe — please try again." onRetry={refetch} />;
  }

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="wallet-card">
            <div className="wallet-header">
              <h2>
                <i className="fas fa-wallet me-2" style={{ color: "white" }}></i>My Wallet
              </h2>
            </div>

            <div className="wallet-body">
              <div className="text-center mb-4">
                <p className="mb-1">Current Balance</p>
                <h3 className="balance">₹{(user?.wallet || 0).toFixed(2)}</h3>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="amount" className="form-label">
                    Add Amount
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fas fa-rupee-sign"></i>
                    </span>
                    <input type="number" className="form-control" id="amount" min="0" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-add w-100" disabled={adding}>
                  <i className="fas fa-plus-circle me-2"></i>
                  {adding ? "Processing..." : "Add to Wallet"}
                </button>
              </form>
              <div className="mt-4">
                <h5 className="mb-3">Quick Add</h5>
                <div className="d-flex justify-content-between">
                  <button className="btn btn-outline-primary" disabled={adding} onClick={() => quickAdd(10)}>
                    ₹10
                  </button>
                  <button className="btn btn-outline-primary" disabled={adding} onClick={() => quickAdd(50)}>
                    ₹50
                  </button>
                  <button className="btn btn-outline-primary" disabled={adding} onClick={() => quickAdd(100)}>
                    ₹100
                  </button>
                </div>
              </div>
            </div>
            <div className="transaction-history" style={{ border: "1px solid #ddd" }}>
              <h3 className="mb-4" style={{ fontSize: "1.25rem", position: "sticky", top: 0, background: "white", zIndex: 1, padding: 8 }}>
                Recent Transactions
              </h3>
              <div className="transaction-list">
                {transactions.length > 0 ? (
                  transactions.map((transaction) => (
                    <div className="transaction-item p-3 mb-3 d-flex align-items-center" key={transaction._id}>
                      <div
                        className="icon-container me-3 d-flex align-items-center justify-content-center"
                        style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: transaction.type === "credit" ? "#e6f4ea" : "#fdecea", marginRight: 8 }}
                      >
                        <i className={`bi ${transaction.type === "credit" ? "bi-wallet-fill text-success" : "bi-cash-stack text-danger"}`} style={{ fontSize: "1.5rem" }}></i>
                      </div>
                      <div className="flex-grow-1">
                        <h4 className="fs-1 mb-0 ms-1" style={{ fontSize: "0.875rem" }}>
                          {transaction.description}
                        </h4>
                      </div>
                      <div className="text-end">
                        <span className={`fs-5 fw-bold ${transaction.type === "credit" ? "text-success" : "text-danger"}`} style={{ fontSize: "0.75rem" }}>
                          {transaction.type === "credit" ? "+" : "-"}₹{transaction.amount.toFixed(2)}
                        </span>
                        <p className="text-muted mb-0" style={{ fontSize: "0.75rem" }}>
                          {new Date(transaction.date).toISOString().split("T")[0]}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center">No transactions found.</p>
                )}
              </div>

              <div className="pagination-controls mt-4 d-flex justify-content-center align-items-center">
                {currentPage > 1 && (
                  <>
                    <button className="btn btn-outline-primary me-2" title="First Page" onClick={() => setSearchParams({ page: "1" })}>
                      <i className="bi bi-chevron-double-left"></i>
                    </button>
                    <button className="btn btn-outline-primary me-2" title="Previous Page" onClick={() => setSearchParams({ page: String(currentPage - 1) })}>
                      <i className="bi bi-chevron-left"></i>
                    </button>
                  </>
                )}
                <div className="page-info mx-2">
                  <span className="badge bg-secondary fs-6">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
                {currentPage < totalPages && (
                  <>
                    <button className="btn btn-outline-primary ms-2" title="Next Page" onClick={() => setSearchParams({ page: String(currentPage + 1) })}>
                      <i className="bi bi-chevron-right"></i>
                    </button>
                    <button className="btn btn-outline-primary ms-2" title="Last Page" onClick={() => setSearchParams({ page: String(totalPages) })}>
                      <i className="bi bi-chevron-double-right"></i>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
