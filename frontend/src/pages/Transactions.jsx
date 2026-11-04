
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

function Transactions() {
  const navigate = useNavigate();

  const [status, setStatus] = useState("all");
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/withdrawals?status=${status}&page=1&limit=20`
      );

      setWithdrawals(response.data.withdrawals);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to load transaction history."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [status]);

  const filters = ["all", "paid", "pending", "rejected"];

  return (
    <div className="history-container">

      <header className="wallet-header">
        <h2>VELoop Rewards</h2>
        <button onClick={() => navigate("/wallet")}>
          Back to Wallet
        </button>
      </header>

      <main className="history-content">
        <h1>Withdrawal History</h1>
        <p>View and track your withdrawal requests.</p>

        <div className="filter-buttons">
          {filters.map((filter) => (
            <button
              key={filter}
              className={status === filter ? "active-filter" : ""}
              onClick={() => setStatus(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {loading && <p>Loading transactions...</p>}

        {error && <p className="error">{error}</p>}

        {!loading && !error && withdrawals.length === 0 && (
          <p className="empty-message">
            No withdrawal records found.
          </p>
        )}

        {!loading && withdrawals.map((item) => (
          <div className="history-card" key={item._id}>
            <div>
              <h3>{item.method.toUpperCase()}</h3>

              <p>Voucher: ₹{item.payoutAmount}</p>

              <p>
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="history-amount">
              <strong>{item.currencyAmount.toLocaleString("en-IN")} VEs</strong>

              <span className={`status ${item.status.toLowerCase()}`}>
                {item.status === "APPROVED"
                  ? "Paid"
                  : item.status}
              </span>
            </div>
          </div>
        ))}

      </main>
    </div>
  );
}

export default Transactions;
