
const PayoutMethod = require("../models/PayoutMethod");
const PayoutOption = require("../models/PayoutOption");

// Get all payout methods
const getPayoutMethods = async (req, res) => {
  try {
    const methods = await PayoutMethod.find({
      active: true
    }).sort({ displayOrder: 1 });

    res.status(200).json({
      success: true,
      methods
    });

  } catch (error) {
    console.error("Payout methods error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to fetch payout methods."
    });
  }
};

// Get vouchers for a selected method
const getPayoutOptions = async (req, res) => {
  try {
    const method = req.params.method.toLowerCase();

    const payoutMethod = await PayoutMethod.findOne({
      methodId: method,
      active: true
    });

    if (!payoutMethod) {
      return res.status(404).json({
        success: false,
        message: "Payout method not found."
      });
    }

    if (!payoutMethod.available) {
      return res.status(409).json({
        success: false,
        message: "This payout method is currently unavailable."
      });
    }

    const options = await PayoutOption.find({
      method,
      active: true
    }).sort({ payoutAmount: 1 });

    res.status(200).json({
      success: true,
      method: payoutMethod.name,
      options
    });

  } catch (error) {
    console.error("Payout options error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to fetch payout options."
    });
  }
};

module.exports = {
  getPayoutMethods,
  getPayoutOptions
};
