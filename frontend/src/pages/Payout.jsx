
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

function Payout() {
  const navigate = useNavigate();

  const [methods, setMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState("upi");
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [upiId, setUpiId] = useState("");

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedVoucher = options.find(
    (option) => option.optionId === selectedOption
  );

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const response = await api.get("/payout/methods");
        setMethods(response.data.methods);
      } catch (err) {
        if (err.response?.status === 401) {
          sessionStorage.clear();
          navigate("/");
          return;
        }

        setError(
          err.response?.data?.message ||
          "Unable to load payout methods."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const fetchOptions = async () => {
      setOptions([]);
      setSelectedOption("");
      setError("");

      if (!selectedMethod) return;

      setOptionsLoading(true);

      try {
        const response = await api.get(
          `/payout/options/${selectedMethod}`
        );

        if (!cancelled) {
          setOptions(response.data.options);
        }
      } catch (err) {
        if (!cancelled) {
          if (err.response?.status === 401) {
            sessionStorage.clear();
            navigate("/");
            return;
          }

          setError(
            err.response?.data?.message ||
            "Unable to load payout options."
          );
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    };

    fetchOptions();

    return () => {
      cancelled = true;
    };
  }, [selectedMethod, navigate]);

  const handleFormSubmit = (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!selectedVoucher) {
      setError("Please select a valid voucher.");
      return;
    }

    if (!upiId.trim()) {
      setError("Please enter your UPI ID.");
      return;
    }

    setShowConfirmation(true);
  };

  const confirmWithdrawal = async () => {
    if (!selectedVoucher || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await api.post("/withdrawals", {
        method: selectedMethod,
        optionId: selectedOption,
        payoutDetails: {
          upiId: upiId.trim()
        },
        idempotencyKey: crypto.randomUUID()
      });

      const withdrawal = response.data.withdrawal;

      setShowConfirmation(false);

      // Returning to Wallet automatically reloads
      // the latest balance and recent transactions.
      navigate("/wallet", {
        state: {
          successMessage:
            `Withdrawal submitted successfully. Status: ${withdrawal.status}`
        }
      });

    } catch (err) {
      if (err.response?.status === 401) {
        sessionStorage.clear();
        navigate("/");
        return;
      }

      setError(
        err.response?.data?.message ||
        "Withdrawal request failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="loading">Loading payout methods...</p>;
  }

  return (
    <div className="payout-container">
      <header className="wallet-header">
        <h2>VELoop Rewards</h2>

        <button onClick={() => navigate("/wallet")}>
          Back to Wallet
        </button>
      </header>

      <main className="payout-content">
        <h1>Redeem Your Rewards</h1>
        <p>Select your preferred payout method.</p>

        <label>Payout Method</label>

        <select
          value={selectedMethod}
          onChange={(e) => {
            setSelectedMethod(e.target.value);
            setMessage("");
            setShowConfirmation(false);
          }}
        >
          {methods.map((method) => (
            <option
              key={method.methodId}
              value={method.methodId}
              disabled={!method.available}
            >
              {method.name}
              {!method.available
                ? ` - Unavailable${method.unavailableReason
                    ? ` (${method.unavailableReason})`
                    : ""}`
                : ""}
            </option>
          ))}
        </select>

        {error && <p className="error">{error}</p>}

        {selectedMethod !== "upi" && (
          <p className="info">
            The demonstration currently supports UPI withdrawals only.
          </p>
        )}

        {selectedMethod === "upi" && (
          <form onSubmit={handleFormSubmit}>
            <h2>Available UPI Vouchers</h2>

            {optionsLoading && (
              <p className="loading">Loading vouchers...</p>
            )}

            {!optionsLoading && options.length === 0 && (
              <p>No payout options are currently available.</p>
            )}

            <div className="voucher-grid">
              {options.map((option) => (
                <label
                  key={option.optionId}
                  className={`voucher-card ${
                    selectedOption === option.optionId
                      ? "selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="voucher"
                    value={option.optionId}
                    checked={selectedOption === option.optionId}
                    onChange={() => setSelectedOption(option.optionId)}
                  />

                  <h3>₹{option.payoutAmount}</h3>

                  <p>
                    {option.requiredAmount.toLocaleString("en-IN")} VEs
                  </p>
                </label>
              ))}
            </div>

            {selectedOption && (
              <>
                <label>Enter your UPI ID</label>

                <input
                  type="text"
                  placeholder="example@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  required
                />

                <button
                  type="submit"
                  disabled={submitting || optionsLoading}
                >
                  Review Withdrawal
                </button>
              </>
            )}
          </form>
        )}

        {message && (
          <p className="success-message">{message}</p>
        )}
      </main>

      {showConfirmation && selectedVoucher && (
        <div
          className="confirmation-overlay"
          role="presentation"
          onClick={(e) => {
            if (
              e.target === e.currentTarget &&
              !submitting
            ) {
              setShowConfirmation(false);
            }
          }}
        >
          <section
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
          >
            <h2 id="confirmation-title">
              Confirm Your Withdrawal
            </h2>

            <p>Please review your redemption details.</p>

            <div className="confirmation-details">
              <div>
                <span>Payout Amount</span>
                <strong>₹{selectedVoucher.payoutAmount}</strong>
              </div>

              <div>
                <span>Required VEs</span>
                <strong>
                  {selectedVoucher.requiredAmount.toLocaleString("en-IN")} VEs
                </strong>
              </div>

              <div>
                <span>Payout Method</span>
                <strong>UPI Transfer</strong>
              </div>

              <div>
                <span>UPI ID</span>
                <strong>{upiId.trim()}</strong>
              </div>
            </div>

            <p className="confirmation-warning">
              The required VEs will be deducted when the request is
              successfully submitted. The withdrawal will initially
              have PENDING status.
            </p>

            {error && (
              <p className="error">{error}</p>
            )}

            <div className="confirmation-actions">
              <button
                type="button"
                className="cancel-button"
                disabled={submitting}
                onClick={() => {
                  setShowConfirmation(false);
                  setError("");
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={confirmWithdrawal}
              >
                {submitting
                  ? "Processing..."
                  : "Confirm Withdrawal"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Payout;
