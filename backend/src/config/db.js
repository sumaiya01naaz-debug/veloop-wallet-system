const dns = require("node:dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    throw error;
  }
};

module.exports = connectDB;