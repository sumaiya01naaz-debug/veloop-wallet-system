
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const formatDate = (date) =>
  date ? new Date(date).toLocaleString("en-IN") : "-";

function Admin() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [wallet, setWallet] = useState(null);

  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalStatus, setWithdrawalStatus] = useState("ALL");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [adjustmentType, setAdjustmentType] = useState("CREDIT");
  const [currency, setCurrency] = useState("VES");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const handleError = (err, fallback) => {
    if (err.response?.status === 401) {
      sessionStorage.clear();
      navigate("/");
      return;
    }

    setError(err.response?.data?.message || fallback);
  };

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/users", {
        params: {
          search: search.trim() || undefined,
          page: 1,
          limit: 50
        }
      });

      setUsers(response.data.users);
    } catch (err) {
      handleError(err, "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadUserWallet = async (user) => {
    setLoading(true);
    setError("");
    setSelectedUser(user);
    setWallet(null);

    try {
      const response = await api.get(
        `/admin/users/${user._id}/wallet`
      );

      setSelectedUser(response.data.user);
      setWallet(response.data.wallet);
    } catch (err) {
      handleError(err, "Unable to load user wallet.");
    } finally {
      setLoading(false);
    }
  };

  const loadWithdrawals = async (
    status = withdrawalStatus
  ) => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/withdrawals", {
        params: {
          status,
          page: 1,
          limit: 50
        }
      });

      setWithdrawals(response.data.withdrawals);
    } catch (err) {
      handleError(err, "Unable to load withdrawals.");
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/transactions", {
        params: {
          page: 1,
          limit: 50
        }
      });

      setTransactions(response.data.transactions);
    } catch (err) {
      handleError(err, "Unable to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/audit-logs", {
        params: {
          page: 1,
          limit: 50
        }
      });

      setAuditLogs(response.data.auditLogs);
    } catch (err) {
      handleError(err, "Unable to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const changeTab = (tab) => {
    setActiveTab(tab);
    setError("");
    setNotice("");

    if (tab === "users") loadUsers();
    if (tab === "withdrawals") loadWithdrawals("ALL");
    if (tab === "transactions") loadTransactions();
    if (tab === "audit") loadAuditLogs();
  };

  const handleWalletAdjustment = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!selectedUser) {
      setError("Please select a user first.");
      return;
    }

    const numericAmount = Number(amount);

    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid positive whole-number amount.");
      return;
    }

    if (!description.trim()) {
      setError("Please enter an adjustment description.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        adjustmentType === "CREDIT"
          ? "/wallet/credit"
          : "/wallet/debit";

      await api.post(endpoint, {
        userId: selectedUser._id,
        currency,
        amount: numericAmount,
        description: description.trim()
      });

      const response = await api.get(
        `/admin/users/${selectedUser._id}/wallet`
      );

      setWallet(response.data.wallet);
      setAmount("");
      setDescription("");

      setNotice(
        `Wallet ${adjustmentType.toLowerCase()} completed successfully.`
      );
    } catch (err) {
      handleError(err, "Wallet adjustment failed.");
    } finally {
      setLoading(false);
    }
  };

  const viewWithdrawal = async (id) => {
    setLoading(true);
    setError("");
    setSelectedWithdrawal(null);
    setReviewNote("");
    setRejectionReason("");

    try {
      const response = await api.get(
        `/admin/withdrawals/${id}`
      );

      setSelectedWithdrawal(response.data.withdrawal);
    } catch (err) {
      handleError(err, "Unable to fetch withdrawal details.");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawalReview = async (action) => {
    if (!selectedWithdrawal) return;

    if (
      action === "reject" &&
      !rejectionReason.trim()
    ) {
      setError("A rejection reason is required.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this withdrawal?`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const url =
        `/withdrawals/${selectedWithdrawal._id}/${action}`;

      const body =
        action === "approve"
          ? { reviewNote: reviewNote.trim() }
          : {
              rejectionReason: rejectionReason.trim(),
              reviewNote: reviewNote.trim()
            };

      await api.patch(url, body);

      const actionLabel =
  action === "approve" ? "approved" : "rejected";

setNotice(`Withdrawal ${actionLabel} successfully.`);

      await loadWithdrawals(withdrawalStatus);
      await viewWithdrawal(selectedWithdrawal._id);

    } catch (err) {
      handleError(err, `Unable to ${action} withdrawal.`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  return (
    <div className="admin-container">
      <header className="wallet-header">
        <div>
          <h2>VELoop Admin</h2>
          <p>Administrator Control Panel</p>
        </div>

        <button onClick={handleLogout}>Logout</button>
      </header>

      <main className="admin-content">
        <h1>Dashboard</h1>
        <p>Manage users, wallets and withdrawal activity.</p>

        <nav className="admin-tabs">
          {[
            ["users", "Users & Wallets"],
            ["withdrawals", "Withdrawals"],
            ["transactions", "Transactions"],
            ["audit", "Audit Logs"]
          ].map(([tab, label]) => (
            <button
              key={tab}
              className={
                activeTab === tab ? "admin-tab active" : "admin-tab"
              }
              onClick={() => changeTab(tab)}
            >
              {label}
            </button>
          ))}
        </nav>

        {error && <p className="error admin-message">{error}</p>}
        {notice && <p className="success-message">{notice}</p>}

        {loading && <p className="loading">Loading...</p>}

        {!loading && activeTab === "users" && (
          <section className="admin-panel">
            <h2>User Management</h2>

            <form
              className="admin-search"
              onSubmit={(e) => {
                e.preventDefault();
                setSelectedUser(null);
                setWallet(null);
                loadUsers();
              }}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
              />
              <button type="submit">Search</button>
            </form>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.accountStatus}</td>
                      <td>
                        <button
                          onClick={() => loadUserWallet(user)}
                        >
                          View Wallet
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {users.length === 0 && <p>No users found.</p>}

            {selectedUser && (
              <div className="admin-panel nested-panel">
                <h3>{selectedUser.name}'s Wallet</h3>
                <p>{selectedUser.email}</p>

                {wallet ? (
                  <>
                    <div className="admin-balance-grid">
                      {[
                        ["VES", wallet.ves],
                        ["SVES", wallet.sves],
                        ["GEMS", wallet.gems],
                        ["TOKENS", wallet.tokens],
                        ["SPINS", wallet.spins]
                      ].map(([label, value]) => (
                        <div className="admin-balance" key={label}>
                          <span>{label}</span>
                          <strong>
                            {Number(value || 0).toLocaleString("en-IN")}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <h3>Manual Wallet Adjustment</h3>

                    <form
                      className="admin-form"
                      onSubmit={handleWalletAdjustment}
                    >
                      <label>Action</label>
                      <select
                        value={adjustmentType}
                        onChange={(e) =>
                          setAdjustmentType(e.target.value)
                        }
                      >
                        <option value="CREDIT">Credit</option>
                        <option value="DEBIT">Debit</option>
                      </select>

                      <label>Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                      >
                        {["VES", "SVES", "GEMS", "TOKENS", "SPINS"].map(
                          (item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          )
                        )}
                      </select>

                      <label>Amount</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />

                      <label>Reason / Description</label>
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={250}
                        required
                      />

                      <button type="submit" disabled={loading}>
                        {loading
                          ? "Processing..."
                          : `${adjustmentType} Wallet`}
                      </button>
                    </form>
                  </>
                ) : (
                  <p>Wallet not found for this user.</p>
                )}
              </div>
            )}
          </section>
        )}

        {!loading && activeTab === "withdrawals" && (
          <section className="admin-panel">
            <h2>Withdrawal Management</h2>

            <label>Filter by status</label>
            <select
              value={withdrawalStatus}
              onChange={(e) => {
                setWithdrawalStatus(e.target.value);
                loadWithdrawals(e.target.value);
              }}
            >
              {[
                "ALL",
                "PENDING",
                "PROCESSING",
                "APPROVED",
                "REJECTED",
                "CANCELLED"
              ].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <div className="admin-list">
              {withdrawals.map((item) => (
                <div className="admin-list-item" key={item._id}>
                  <div>
                    <strong>
                      {item.userId?.name || "Unknown user"}
                    </strong>
                    <p>{item.userId?.email || item.userId}</p>
                    <p>
                      ₹{item.payoutAmount} ·{" "}
                      {item.currencyAmount.toLocaleString("en-IN")} VES
                    </p>
                    <span className="status">
                      {item.status}
                    </span>
                  </div>

                  <button
                    onClick={() => viewWithdrawal(item._id)}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>

            {withdrawals.length === 0 && (
              <p>No withdrawals found.</p>
            )}

            {selectedWithdrawal && (
              <div className="admin-panel nested-panel">
                <h3>Withdrawal Details</h3>
                <p>
                  Withdrawal ID: {selectedWithdrawal._id}
                </p>
                <p>
                  User: {selectedWithdrawal.userId?.email}
                </p>
                <p>Method: {selectedWithdrawal.method}</p>
                <p>Option: {selectedWithdrawal.optionId}</p>
                <p>Amount: ₹{selectedWithdrawal.payoutAmount}</p>
                <p>
                  Required VES:{" "}
                  {selectedWithdrawal.currencyAmount.toLocaleString("en-IN")}
                </p>
                <p>Status: {selectedWithdrawal.status}</p>
                <p>
                  Requested: {formatDate(selectedWithdrawal.requestedAt)}
                </p>

                <h4>Verified Payout Details</h4>
                <pre className="admin-json">
                  {JSON.stringify(
                    selectedWithdrawal.payoutDetails,
                    null,
                    2
                  )}
                </pre>

                {selectedWithdrawal.transactionId && (
                  <>
                    <h4>Related Wallet Transaction</h4>
                    <pre className="admin-json">
                      {JSON.stringify(
                        selectedWithdrawal.transactionId,
                        null,
                        2
                      )}
                    </pre>
                  </>
                )}

                {["PENDING", "PROCESSING"].includes(
                  selectedWithdrawal.status
                ) && (
                  <div className="admin-form">
                    <label>Review Note</label>
                    <input
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      maxLength={500}
                    />

                    <button
                      onClick={() => handleWithdrawalReview("approve")}
                      disabled={loading}
                    >
                      Approve Withdrawal
                    </button>

                    <label>Rejection Reason (required)</label>
                    <input
                      value={rejectionReason}
                      onChange={(e) =>
                        setRejectionReason(e.target.value)
                      }
                      maxLength={500}
                    />

                    <button
                      className="admin-danger"
                      onClick={() => handleWithdrawalReview("reject")}
                      disabled={loading}
                    >
                      Reject Withdrawal
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {!loading && activeTab === "transactions" && (
          <section className="admin-panel">
            <h2>Wallet Transactions</h2>

            <button onClick={loadTransactions}>
              Refresh
            </button>

            <div className="admin-list">
              {transactions.map((item) => (
                <div className="admin-list-item" key={item._id}>
                  <div>
                    <strong>
                      {item.userId?.name || "Unknown user"}
                    </strong>
                    <p>{item.userId?.email}</p>
                    <p>
                      {item.type} · {item.currency} ·{" "}
                      {item.amount.toLocaleString("en-IN")}
                    </p>
                    <p>
                      Source: {item.source} · Status: {item.status}
                    </p>
                    <p>
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {transactions.length === 0 && (
              <p>No transactions found.</p>
            )}
          </section>
        )}

        {!loading && activeTab === "audit" && (
          <section className="admin-panel">
            <h2>Audit Logs</h2>

            <button onClick={loadAuditLogs}>
              Refresh
            </button>

            <div className="admin-list">
              {auditLogs.map((item) => (
                <div className="admin-list-item" key={item._id}>
                  <div>
                    <strong>{item.action}</strong>
                    <p>
                      Actor: {item.actorId?.email || "System"}
                    </p>
                    <p>
                      Target: {item.targetUserId?.email || "-"}
                    </p>
                    <p>Type: {item.targetType}</p>
                    <p>Reference: {item.referenceId || "-"}</p>
                    <p>{formatDate(item.createdAt)}</p>
                    {item.ipAddress && (
                      <p>IP: {item.ipAddress}</p>
                    )}
                  </div>

                  <details>
                    <summary>View Metadata</summary>
                    <pre className="admin-json">
                      {JSON.stringify(item.metadata, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>

            {auditLogs.length === 0 && (
              <p>No audit logs found.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default Admin;
