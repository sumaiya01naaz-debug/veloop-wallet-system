
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const response = await api.get("/payout/methods");
        setMethods(response.data.methods);
      } catch (err) {
        setError("Unable to load payout methods.");
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      setOptions([]);
      setSelectedOption("");
      setError("");

      try {
        const response = await api.get(
          `/payout/options/${selectedMethod}`
        );

        setOptions(response.data.options);
      } catch (err) {
        setError(
          err.response?.data?.message ||
          "Unable to load payout options."
        );
      }
    };

    if (selectedMethod) {
      fetchOptions();
    }
  }, [selectedMethod]);

  const handleWithdrawal = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!selectedOption) {
      setError("Please select a voucher.");
      return;
    }

    if (!upiId.trim()) {
      setError("Please enter your UPI ID.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post("/withdrawals", {
        method: selectedMethod,
        optionId: selectedOption,
        payoutDetails: {
          upiId: upiId.trim()
        },
        idempotencyKey: crypto.randomUUID()
      });

      setMessage(
        `Withdrawal submitted successfully! Status: ${response.data.withdrawal.status}`
      );

      setSelectedOption("");

      setUpiId("");

    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Withdrawal request failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p>Loading payout methods...</p>;

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
          }}
        >
          {methods.map((method) => (
            <option
              key={method.methodId}
              value={method.methodId}
              disabled={!method.available}
            >
              {method.name}
              {!method.available ? " - Unavailable" : ""}
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
          <form onSubmit={handleWithdrawal}>

            <h2>Available UPI Vouchers</h2>

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

                <button type="submit" disabled={submitting}>
                  {submitting
                    ? "Submitting..."
                    : "Confirm Withdrawal"}
                </button>
              </>
            )}

          </form>
        )}

        {message && (
          <p className="success-message">{message}</p>
        )}

      </main>
    </div>
  );
}

export default Payout;
