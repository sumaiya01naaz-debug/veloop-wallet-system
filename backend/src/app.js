
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const walletRoutes = require("./routes/walletRoutes");
const payoutRoutes = require("./routes/payoutRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");

const app = express();

const allowedOrigins = (
  process.env.CLIENT_URL || "http://localhost:5173"
).split(",").map(url => url.trim());

app.use(express.json());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  }
}));

app.get("/", (req, res) => {
  res.send("VELoop Wallet Backend Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payout", payoutRoutes);
app.use("/api/withdrawals", withdrawalRoutes);

module.exports = app;
