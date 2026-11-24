
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const formatDate = (date) =>
  new Date(date).toLocaleString("en-IN");

function Transactions() {
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState("ledger");

  const [ledger, setLedger] = useState([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerReload, setLedgerReload] = useState(0);
  const [ledgerPagination, setLedgerPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState("");

  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalStatus, setWithdrawalStatus] = useState("all");
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [withdrawalPagination, setWithdrawalPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState("");

  // Fetch the complete wallet ledger
  useEffect(() => {
    let cancelled = false;

    const fetchLedger = async () => {
      setLedgerLoading(true);
      setLedgerError("");

      try {
        const response = await api.get(
          `/wallet/transactions?page=${ledgerPage}&limit=20`
        );

        if (!cancelled) {
          setLedger(response.data.transactions);
          setLedgerPagination(response.data.pagination);
        }

      } catch (err) {
        if (cancelled) return;

        if (err.response?.status === 401) {
          sessionStorage.clear();
          navigate("/");
          return;
        }

        setLedgerError(
          err.response?.data?.message ||
          "Unable to load wallet transactions."
        );
      } finally {
        if (!cancelled) {
          setLedgerLoading(false);
        }
      }
    };

    if (activeView === "ledger") {
      fetchLedger();
    }

    return () => {
      cancelled = true;
    };
  }, [activeView, ledgerPage, ledgerReload, navigate]);

  // Fetch withdrawal history separately
  useEffect(() => {
    let cancelled = false;

    const fetchWithdrawals = async () => {
      setWithdrawalLoading(true);
      setWithdrawalError("");

      try {
        const response = await api.get("/withdrawals", {
          params: {
            status: withdrawalStatus,
            page: withdrawalPage,
            limit: 20
          }
        });

        if (!cancelled) {
          setWithdrawals(response.data.withdrawals);
          setWithdrawalPagination(response.data.pagination);
        }

      } catch (err) {
        if (cancelled) return;

        if (err.response?.status === 401) {
          sessionStorage.clear();
          navigate("/");
          return;
        }

        setWithdrawalError(
          err.response?.data?.message ||
          "Unable to load withdrawal history."
        );
      } finally {
        if (!cancelled) {
          setWithdrawalLoading(false);
        }
      }
    };

    if (activeView === "withdrawals") {
      fetchWithdrawals();
    }

    return () => {
      cancelled = true;
    };
  }, [activeView, withdrawalStatus, withdrawalPage, navigate]);

  const filters = [
    "all",
    "pending",
    "processing",
    "paid",
    "rejected",
    "cancelled"
  ];

  return (
    <div className="history-container">
      <header className="wallet-header">
        <h2>VELoop Rewards</h2>

        <button onClick={() => navigate("/wallet")}>
          Back to Wallet
        </button>
      </header>

      <main className="history-content">
        <h1>Transaction History</h1>
        <p>View your wallet activity and withdrawal requests.</p>

        <div className="history-tabs">
          <button
            className={
              activeView === "ledger" ? "active-filter" : ""
            }
            onClick={() => setActiveView("ledger")}
          >
            Wallet Transactions
          </button>

          <button
            className={
              activeView === "withdrawals" ? "active-filter" : ""
            }
            onClick={() => setActiveView("withdrawals")}
          >
            Withdrawal History
          </button>
        </div>

        {activeView === "ledger" && (
          <section className="history-panel">
            <div className="transactions-heading">
              <h2>Wallet Ledger</h2>

              <button
  className="secondary-button"
  onClick={() => setLedgerReload((value) => value + 1)}
  disabled={ledgerLoading}
>
  Refresh
</button>
            </div>

            {ledgerLoading && (
              <p className="loading">Loading transactions...</p>
            )}

            {ledgerError && (
              <p className="error">{ledgerError}</p>
            )}

            {!ledgerLoading &&
              !ledgerError &&
              ledger.length === 0 && (
                <p className="empty-message">
                  No wallet transactions found.
                </p>
              )}

            {!ledgerLoading && !ledgerError &&
              ledger.map((item) => (
                <div className="history-card" key={item._id}>
                  <div>
                    <h3>
                      {item.description || item.source}
                    </h3>

                    <p>
                      {item.type} · {item.currency}
                    </p>

                    <p>
                      Source: {item.source}
                    </p>

                    <p>
                      {formatDate(item.createdAt)}
                    </p>

                    <span
                      className={`status ${item.status.toLowerCase()}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="history-amount">
                    <strong
                      className={
                        item.type === "CREDIT"
                          ? "credit"
                          : "debit"
                      }
                    >
                      {item.type === "CREDIT" ? "+" : "-"}
                      {item.amount.toLocaleString("en-IN")}{" "}
                      {item.currency}
                    </strong>

                    <small>
                      Balance after:{" "}
                      {item.balanceAfter.toLocaleString("en-IN")}
                    </small>
                  </div>
                </div>
              ))}

            {!ledgerLoading && !ledgerError && (
              <div className="history-pagination">
                <button
                  disabled={ledgerPage <= 1}
                  onClick={() => setLedgerPage((page) => page - 1)}
                >
                  Previous
                </button>

                <span>
                  Page {ledgerPagination.page} of{" "}
                  {Math.max(ledgerPagination.totalPages, 1)}
                  {" "}({ledgerPagination.total} records)
                </span>

                <button
                  disabled={
                    ledgerPage >= ledgerPagination.totalPages
                  }
                  onClick={() => setLedgerPage((page) => page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        )}

        {activeView === "withdrawals" && (
          <section className="history-panel">
            <h2>Withdrawal Requests</h2>

            <div className="filter-buttons">
              {filters.map((filter) => (
                <button
                  key={filter}
                  className={
                    withdrawalStatus === filter
                      ? "active-filter"
                      : ""
                  }
                  onClick={() => {
                    setWithdrawalStatus(filter);
                    setWithdrawalPage(1);
                  }}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {withdrawalLoading && (
              <p className="loading">
                Loading withdrawal history...
              </p>
            )}

            {withdrawalError && (
              <p className="error">{withdrawalError}</p>
            )}

            {!withdrawalLoading &&
              !withdrawalError &&
              withdrawals.length === 0 && (
                <p className="empty-message">
                  No withdrawal records found.
                </p>
              )}

            {!withdrawalLoading && !withdrawalError &&
              withdrawals.map((item) => (
                <div className="history-card" key={item._id}>
                  <div>
                    <h3>{item.method.toUpperCase()}</h3>

                    <p>
                      Voucher: ₹{item.payoutAmount}
                    </p>

                    <p>
                      {formatDate(item.createdAt)}
                    </p>

                    <span
                      className={`status ${item.status.toLowerCase()}`}
                    >
                      {item.status === "APPROVED"
                        ? "Paid"
                        : item.status}
                    </span>
                  </div>

                  <div className="history-amount">
                    <strong>
                      {item.currencyAmount.toLocaleString("en-IN")} VEs
                    </strong>
                  </div>
                </div>
              ))}

            {!withdrawalLoading && !withdrawalError && (
              <div className="history-pagination">
                <button
                  disabled={withdrawalPage <= 1}
                  onClick={() =>
                    setWithdrawalPage((page) => page - 1)
                  }
                >
                  Previous
                </button>

                <span>
                  Page {withdrawalPagination.page} of{" "}
                  {Math.max(withdrawalPagination.totalPages, 1)}
                  {" "}({withdrawalPagination.total} records)
                </span>

                <button
                  disabled={
                    withdrawalPage >=
                    withdrawalPagination.totalPages
                  }
                  onClick={() =>
                    setWithdrawalPage((page) => page + 1)
                  }
                >
                  Next
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default Transactions;
