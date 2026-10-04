const mongoose = require("mongoose");

// Journal de tous les SMS opérateurs reçus par les téléphones : rien n'est perdu, tout est traçable.
const smsSchema = mongoose.Schema({
    user_id: {type: String},
    from: {type: String},
    body: {type: String},
    receivedAt: {type: Date},
    hash: {type: String},
    actions: {type: Array},
    error: {type: String},
    date: {type: Date}
})

smsSchema.index({ hash: 1 }, { unique: true });

module.exports = mongoose.model("Sms", smsSchema);
