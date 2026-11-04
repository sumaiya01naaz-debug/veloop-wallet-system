
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

function Wallet() {
  const navigate = useNavigate();

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWalletData = async () => {
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
          sessionStorage.removeItem("token");
          navigate("/");
          return;
        }

        setError("Unable to load wallet information.");
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    navigate("/");
  };

  if (loading) return <p className="loading">Loading wallet...</p>;

  if (error) return <p className="error">{error}</p>;

  return (
    <div className="wallet-container">
      <header className="wallet-header">
        <h1>VELoop Rewards</h1>
        <button onClick={handleLogout}>Logout</button>
      </header>

      <main className="wallet-content">
        <h2>My Wallet</h2>
        <p>Welcome to your rewards wallet!</p>

        {wallet && (
          <section className="balance-card">
            <p>Available VEs</p>
            <h1>{wallet.ves.toLocaleString("en-IN")}</h1>

            <button onClick={() => navigate("/payout")}>
              Withdraw / Redeem
            </button>
          </section>
        )}

        <section className="transactions-section">
          <h2>Recent Transactions</h2>

          {transactions.length === 0 ? (
            <p>No transactions available.</p>
          ) : (
            transactions.map((transaction) => (
              <div className="transaction-card" key={transaction._id}>
                <div>
                  <strong>{transaction.description || transaction.source}</strong>
                  <p>
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <strong className={
                  transaction.type === "CREDIT" ? "credit" : "debit"
                }>
                  {transaction.type === "CREDIT" ? "+" : "-"}
                  {transaction.amount.toLocaleString("en-IN")} VEs
                </strong>
              </div>
            ))
          )}

          <button
            className="secondary-button"
            onClick={() => navigate("/transactions")}
          >
            See All Transactions
          </button>
        </section>
      </main>
    </div>
  );
}

export default Wallet;
