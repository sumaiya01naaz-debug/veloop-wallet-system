
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const PayoutMethod = require("../src/models/PayoutMethod");

const methods = [
  {
    methodId: "upi",
    name: "UPI Transfer",
    description: "Instant Bank Transfer",
    active: true,
    available: true,
    badge: "Instant",
    displayOrder: 1
  },
  {
    methodId: "amazon_pay",
    name: "Amazon Pay",
    description: "Gift Card Balance",
    active: true,
    available: true,
    badge: "Popular",
    displayOrder: 2
  },
  {
    methodId: "google_play",
    name: "Google Play",
    description: "App Store Credit",
    active: true,
    available: true,
    badge: "Fast",
    displayOrder: 3
  },
  {
    methodId: "paypal",
    name: "PayPal",
    description: "Coming Soon",
    active: true,
    available: false,
    badge: "Unavailable",
    unavailableReason: "Currently unavailable in your region.",
    displayOrder: 4
  }
];

const seedMethods = async () => {
  try {
    await connectDB();

    for (const method of methods) {
      await PayoutMethod.updateOne(
        { methodId: method.methodId },
        { $set: method },
        { upsert: true }
      );
    }

    console.log("Payout methods seeded successfully!");

  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;

  } finally {
    await mongoose.connection.close();
  }
};

seedMethods();
