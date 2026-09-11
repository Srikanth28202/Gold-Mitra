const mongoose = require('mongoose');

const jewelleryItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true },
    purity: { type: String, required: true, trim: true },
    weightGrams: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', trim: true },
    photoData: { type: String, default: '' }
  },
  { _id: true }
);

const applicationSchema = new mongoose.Schema(
  {
    applicationNo: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'disbursed'],
      default: 'pending'
    },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },

    customer: {
      name: { type: String, required: true, trim: true },
      mobile: {
        type: String,
        required: true,
        trim: true,
        match: /^[6-9]\d{9}$/
      },
      aadhaar: { type: String, default: '', trim: true },
      address: { type: String, required: true, trim: true },
      photoData: { type: String, default: '' }
    },

    jewelleryItems: {
      type: [jewelleryItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'At least one jewellery item is required'
      }
    },

    totalWeightGrams: { type: Number, default: 0 },

    loan: {
      amount: { type: Number, required: true, min: 1 },
      paymentMode: { type: String, enum: ['cash', 'account'], required: true },
      date: { type: Date, required: true },
      accountDetails: {
        holderName: { type: String, default: '', trim: true },
        accountNumber: { type: String, default: '', trim: true },
        ifsc: { type: String, default: '', trim: true },
        _id: false
      }
    }
  },
  { timestamps: true }
);

applicationSchema.methods.generateApplicationNo = function () {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `GL-${yyyy}${mm}${dd}-${rand}`;
};

module.exports = mongoose.model('Application', applicationSchema);