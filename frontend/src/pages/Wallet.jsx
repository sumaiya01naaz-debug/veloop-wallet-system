
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";

function Wallet() {
  const navigate = useNavigate();
  const location = useLocation();

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] = useState(
    location.state?.successMessage || ""
  );

  const fetchWalletData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [walletResponse, transactionResponse] =
        await Promise.all([
          api.get("/wallet"),
          api.get("/wallet/transactions?page=1&limit=5")
        ]);

      setWallet(walletResponse.data.wallet);
      setTransactions(transactionResponse.data.transactions);

    } catch (err) {
      if (err.response?.status === 401) {
        sessionStorage.clear();
        navigate("/");
        return;
      }

      setError(
        err.response?.data?.message ||
        "Unable to load wallet information."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  // Fetches fresh wallet and ledger data when entering the page.
  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Remove navigation state after displaying the message.
  useEffect(() => {
    if (location.state?.successMessage) {
      navigate(location.pathname, {
        replace: true,
        state: null
      });
    }
  }, [location.state, location.pathname, navigate]);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  if (loading) {
    return <p className="loading">Loading wallet...</p>;
  }

  return (
    <div className="wallet-container">
      <header className="wallet-header">
        <h1>VELoop Rewards</h1>

        <div className="wallet-header-actions">
          {sessionStorage.getItem("role") === "ADMIN" && (
            <button onClick={() => navigate("/admin")}>
              Admin Dashboard
            </button>
          )}

          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="wallet-content">
        <h2>My Wallet</h2>
        <p>Welcome to your rewards wallet!</p>

        {successMessage && (
          <p className="success-message wallet-success">
            {successMessage}
          </p>
        )}

        {error && (
          <div className="error wallet-error">
            <p>{error}</p>
            <button
              className="secondary-button"
              onClick={() => fetchWalletData(true)}
            >
              Retry
            </button>
          </div>
        )}

        {wallet && (
          <section className="balance-card">
            <p>Available VEs</p>

            <h1>
              {wallet.ves.toLocaleString("en-IN")}
            </h1>

            <button onClick={() => navigate("/payout")}>
              Withdraw / Redeem
            </button>
          </section>
        )}

        <section className="transactions-section">
          <div className="transactions-heading">
            <h2>Recent Transactions</h2>

            <button
              className="secondary-button"
              disabled={refreshing}
              onClick={() => fetchWalletData(true)}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {transactions.length === 0 ? (
            <p>No transactions available.</p>
          ) : (
            transactions.map((transaction) => (
              <div
                className="transaction-card"
                key={transaction._id}
              >
                <div>
                  <strong>
                    {transaction.description || transaction.source}
                  </strong>

                  <p>
                    {new Date(
                      transaction.createdAt
                    ).toLocaleString("en-IN")}
                  </p>

                  <p>
                    {transaction.status} · {transaction.currency}
                  </p>
                </div>

                <strong
                  className={
                    transaction.type === "CREDIT"
                      ? "credit"
                      : "debit"
                  }
                >
                  {transaction.type === "CREDIT" ? "+" : "-"}
                  {transaction.amount.toLocaleString("en-IN")}{" "}
                  {transaction.currency}
                </strong>
              </div>
            ))
          )}

          <button
            className="secondary-button"
            onClick={() => navigate("/transactions")}
          >
            See Withdrawal History
          </button>
        </section>
      </main>
    </div>
  );
}

export default Wallet;
