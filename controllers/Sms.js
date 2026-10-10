const crypto = require("crypto");
const Sms = require("../models/Sms");
const User = require("../models/User");
const orderCtrl = require("./Order");
const partnerCtrl = require("./Partner");
const { notifyUser, notifyBalances } = require("../realtime");
const {
    EnvoiAmDetails, EnvoiExpressDetails, extractAgentAmInfo, extractAmBalance, extractCurrentStock,
    extractElementsReceiveMm2, extractEnvoiMmDatas, extractEtopUpInfo, extractMainAccountBalance,
    extractNewStock, extractSendInfo, parseSms, parseTransactionAmDetails
} = require("../utils/smsParsers");

// Exécute un controller existant comme s'il était appelé par l'app, pour garder exactement la même logique.
const runHandler = (handler, userId, body) => new Promise((resolve) => {

    const timeout = setTimeout(() => resolve({ code: 504, body: null }), 15000);

    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { clearTimeout(timeout); resolve({ code: this.statusCode, body: data }); return this; },
        send(data) { clearTimeout(timeout); resolve({ code: this.statusCode, body: data }); return this; }
    };

    Promise.resolve(handler({ auth: { userId }, body, headers: {} }, res)).catch((err) => {
        clearTimeout(timeout);
        resolve({ code: 500, body: { error: err.message } });
    });
});

// Même routage que l'ancien écouteur SMS de BottomTabBar.js, exécuté côté serveur.
const processSms = async (user, from, body) => {

    const userId = user._id.toString();
    const actions = [];

    const run = async (name, handler, payload) => {
        const result = await runHandler(handler, userId, payload);
        actions.push({ name, payload, code: result.code, response: result.body });
    };

    if(from === "AirtelMoney" || from === "+24177336060"){

        if(body.includes("Cher client, le solde de votre compte Airtel Money est de") && !body.includes("[RESENT]")){

            if(extractAmBalance(body)){
                await run("updatepartner", partnerCtrl.updatePartner, {amBalance: Math.round(extractAmBalance(body))});
            }
        }

        if(body.includes("Vous avez envoye") && !body.includes("[RESENT]")){

            const details = EnvoiAmDetails(body);

            if(details.amountSent){
                await run("checkenvoi", orderCtrl.checkSendSMS, {amount: details.amountSent, phone: details.phoneNumber, type: "am", balance: details.newBalance});
            }
        }

        if(body.includes("Vous avez recu") && !body.includes("commission impot") && user.status === "pos"){

            const info = extractAgentAmInfo(body);
            await run("addagentorder", orderCtrl.addAgentOrder, {phone: info.phone, amount: info.amount, status: "retrait", type: "am", _id: userId, trans_id: info.transId});
        }

        if(body.includes("ENVOI reussi de") && user.status === "pos"){

            const info = extractSendInfo(body);
            await run("addagentorder", orderCtrl.addAgentOrder, {phone: info.phone, amount: info.amount, status: "depôt", type: "am", _id: userId, trans_id: info.transId});
        }

        if((body.includes("Vous avez recu") || body.includes("Recu")) && !body.includes("[RESENT]") && !body.includes("commission")){

            const details = parseTransactionAmDetails(body);
            await run("managereturns", orderCtrl.manageReturns2, {amount: details.amountReceived, type: "am", trans_id: details.transactionId, phone: details.senderNumber, balance: details.newBalance});
        }

    }else if(from === "Moov Money"){

        if(body.includes("Le solde de vos comptes Moov Money est de")){

            if(extractMainAccountBalance(body)){
                await run("updatepartner", partnerCtrl.updatePartner, {mmBalance: Math.round(extractMainAccountBalance(body))});
            }
        }

        if(body.includes("Vous avez envoye")){

            if(parseSms(body)){

                const details = extractEnvoiMmDatas(body);
                await run("checkenvoi", orderCtrl.checkSendSMS, {amount: details.amountSent, phone: details.accountNumber, type: "mm", balance: details.balance});
            }
        }

        if(body.includes("Vous avez recu") && (body.includes("du compte Cash Out") || body.includes("du compte Principal"))){

            const details = extractElementsReceiveMm2(body);
            await run("managereturns", orderCtrl.manageReturns2, {amount: details.receivedAmount, type: "mm", trans_id: details.transactionId, phone: details.receiverNumber, balance: details.newBalance});
        }

    }else if(from === "553"){

        if(body.includes("Votre stock actuel est")){
            await run("updatepartner", partnerCtrl.updatePartner, {flashBalance: extractCurrentStock(body)});
        }

        if(body.includes("Transfert de eTopUP")){

            const info = extractEtopUpInfo(body);

            if(info.etopUpAmount){
                await run("checkenvoi", orderCtrl.checkSendSMS, {amount: info.etopUpAmount, phone: info.recipientNumber, type: "flash"});
            }
        }

    }else if(from === "9701"){

        if(body.includes("nouveau stock est")){
            await run("updatepartner", partnerCtrl.updatePartner, {expressBalance: body.includes("nouveau stock est de") ? extractNewStock(body, 1) : extractNewStock(body, 2)});
        }

        if(body.includes("a ete deduit de votre compte et transfere avec succes vers")){

            const details = EnvoiExpressDetails(body);

            if(details.amountSent){
                await run("checkenvoi", orderCtrl.checkSendSMS, {amount: details.amountSent, phone: details.phoneNumber, type: "express"});
            }
        }
    }

    return actions;
};

// Reçoit les SMS mis en file par le téléphone (même app fermée) et renvoie les identifiants acceptés,
// que le téléphone peut alors retirer de sa file. Un SMS déjà reçu n'est jamais traité deux fois.
exports.ingest = async (req, res) => {

    try {

        const user = await User.findOne({_id: req.auth.userId});

        // Les SMS de l'agrégateur et des points de vente sont traités (confirmation d'envoi, soldes, retours).
        // On ne filtre pas sur le drapeau "dispatcher" : les versions de l'app déjà installées ne l'envoient pas,
        // et sans ces SMS les commandes ne passent jamais à "lue". Un SMS reçu par un recouvreur est seulement archivé.
        const canProcess = !!user && (user.status === "pos" || user.status === "agg");

        const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
        const accepted = [];

        for(const message of messages){

            if(!message || !message.from || !message.body){

                if(message && message.id) accepted.push(message.id);
                continue;
            }

            const hash = crypto.createHash("sha256")
                .update(`${req.auth.userId}|${message.from}|${message.body}|${message.receivedAt}`)
                .digest("hex");

            let sms;

            try {

                sms = await Sms.create({
                    user_id: req.auth.userId,
                    from: message.from,
                    body: message.body,
                    receivedAt: message.receivedAt ? new Date(message.receivedAt) : new Date(),
                    hash,
                    date: new Date()
                });

            } catch (err) {

                if(err.code === 11000){
                    accepted.push(message.id);
                    continue;
                }
                throw err;
            }

            if(!canProcess){

                await Sms.updateOne({_id: sms._id}, {$set: {error: "ignoré : téléphone qui n'est pas en envoi automatique"}});
                accepted.push(message.id);
                continue;
            }

            try {

                const actions = await processSms(user, message.from, message.body);
                await Sms.updateOne({_id: sms._id}, {$set: {actions}});

            } catch (err) {

                console.log(err);
                await Sms.updateOne({_id: sms._id}, {$set: {error: err.message}});
            }

            accepted.push(message.id);
        }

        if(accepted.length > 0 && canProcess){

            // Les recouvreurs de l'agrégateur voient ses soldes : on les prévient aussi.
            if(user.status === "agg"){
                await notifyBalances(req.auth.userId);
            }else{
                notifyUser(req.auth.userId, "user:changed");
            }
        }

        res.status(200).json({status: 0, accepted});

    } catch (err) {

        console.log(err);
        res.status(505).json({err: err.message});
    }
};

exports.processSms = processSms;
