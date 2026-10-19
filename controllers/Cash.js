const Cash = require("../models/Cash");
const Order = require("../models/Order");
const { notifyOrder } = require("../realtime");

// Délai pendant lequel une remise identique (même commande, même montant, même auteur) est considérée comme un double clic.
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

// Montant encore remettable sur un retour : même règle que la liste des retours (read: true => seul le reste compte).
const remainingOf = (order) => {

    if(order.read === true){

        return order.rest && order.rest > 0 ? parseInt(order.rest) : 0;
    }

    return order.rest && order.rest > 0 ? parseInt(order.rest) : parseInt(order.amount);
}

exports.addCash = async (req, res) => {

    console.log("on est obligé de changer", req.body);

    try{

      const amount = parseInt(req.body.amount);

      if(!amount || amount <= 0){

          return res.status(200).json({status: 1, message: "Montant invalide"});
      }

      const order = await Order.findOne({_id: req.body._id});

      if(!order){

          return res.status(200).json({status: 1, message: "Retour introuvable"});
      }

      const recent = await Cash.findOne({
          order_id: req.body._id,
          author_id: req.auth.userId,
          amount,
          date: {$gte: new Date(Date.now() - DUPLICATE_WINDOW_MS)}
      });

      if(recent){

          return res.status(200).json({status: 1, message: "Cette remise de "+amount+" Fcfa vient déjà d'être enregistrée"});
      }

      const remaining = remainingOf(order);

      if(amount > remaining){

          return res.status(200).json({status: 1, message: "Le montant est supérieur au reste de "+remaining+" Fcfa"});
      }

      const message = order.message ? order.message+" et une remise d'argent en espèces de "+ amount +" Fcfa ": "Remise en espèces de "+amount+" Fcfa";

      // Mise à jour conditionnelle : si une autre requête a modifié le reste entre-temps, rien n'est écrit.
      const updated = await Order.findOneAndUpdate(
          {
              _id: order._id,
              read: order.read === undefined || order.read === null ? {$in: [null, false]} : order.read,
              rest: order.rest === undefined || order.rest === null ? null : order.rest
          },
          {$set: {rest: remaining - amount, read: true, message}},
          {new: true}
      );

      if(!updated){

          return res.status(200).json({status: 1, message: "Ce retour vient d'être modifié, veuillez actualiser"});
      }

      const newCash = new Cash({

          amount,
          rec_id: order.rec_id,
          agent_id: order.agent_id,
          agg_id: order.agg_id,
          author_id: req.auth.userId,
          date: new Date(),
          order_id: req.body._id,
          phone: order.phone

      });

      await newCash.save();

      notifyOrder(order);

      res.status(201).json({status: 0, message});

    }catch(err){

        console.log(err);
        res.status(500).json({status: 1, message: "Erreur serveur"});
    }

}
