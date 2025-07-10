const Order = require("../models/Order"); 
const User = require("../models/User");
const WebSocket = require('ws');
const Deletedorder = require("../models/Deletedorderr");
const Cash = require("../models/Cash")
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;


exports.getPendingReturns = async (req, res) => {
  
  let reqq = {}; 
  
  console.log(req.body)
  
  if(req.body.status == "agg"){
      
      reqq = `agg_id: ${req.auth.userId}`
    
  }else{
    
      reqq = `rec_id: ${req.auth.userId}`
  }
  
  console.log(reqq);
  
  let orders;
  
  if(req.body.status === "rec"){
    
    orders = await Order.find({
  status: "return",
  $or: [
    { $and: [{ read: true }, { rest: { $gt: 0 } }] },
    { $or: [{ read: false }, { read: { $exists: false } }, { read: null }] },
  ],
  agent_id: {
    $in: (
      await User.find({ rec_id: req.auth.userId }).select("_id")
    ).map((user) => user._id.toString()), // Conversion des ObjectId en chaînes
  },
});
    
  }else{
  
  if(req.body.web){
    
  orders = await  Order.find({
  status: "return",
  agg_id: req.auth.userId,
  $or: [
    {$and: [{read: true}, {rest: { $gt: 0 }}]}, 
    {$or: [{ read: false }, { read: { $exists: false }}, { read: null } ]}
  ]
  
  
})
    
  }else{
    
    orders = await  Order.find({
  status: "return",
  agg_id: req.auth.userId,
  $or: [
    {$and: [{read: true}, {rest: { $gt: 0 }}]}, 
    {$or: [{ read: false }, { read: { $exists: false }}, { read: null } ]}
  ]
  
  
})
  }
  
}
  
   
  
  let sum = 0
  
  for(let order of orders){
    
    if(order.read == true){
      
        sum += order.rest
    
    }else{
      
      sum += order.amount
    }
      
  }
  
  console.log(sum);
  
   res.status(200).json({ status: 0, sum });
  
  
    }

    exports.getList2 = async (req, res) => {
 
  

      try {
        const userFilter = {};
        if (req.body.status == "rec") {
          userFilter.rec_id = req.auth.userId;
        } else if (req.body.status == "agg") {
          userFilter.agg_id = req.auth.userId;
        }
    
        const limit = 10;
        let skip = req.body.skip || 0;
        let usersWithOrders = [];
        let hasMoreUsers = true;
        
      //  console.log("On demarre avec Skip " + skip);
    
        while (usersWithOrders.length < limit && hasMoreUsers) {
          // Étape 1: Récupérer un lot d'utilisateurs avec pagination et tri
          const users = await User.find(userFilter)
            .sort({ date: 1 })
            .lean();
    
          if (users.length === 0) {
            hasMoreUsers = false;
            break;
          }
    
          // Obtenir les user_id
          const userIds = users.map(user => user._id.toString());
    
          // Étape 2: Agréger les commandes pour ces utilisateurs
          const orders = await Order.aggregate([
            {
              $match: {
                agent_id: { $in: userIds },
                status: { $in: ["partial", "initial"] }
              }
            },
            {
              $group: {
                _id: "$agent_id", // Grouper par utilisateur
                totalAmount: {
                  $sum: {
                    $cond: { if: { $eq: ["$status", "initial"] }, then: "$amount", else: 0 }
                  }
                },
                totalRest: {
                  $sum: {
                    $cond: { if: { $eq: ["$status", "partial"] }, then: "$rest", else: 0 }
                  }
                }
              }
            }
          ]);
    
          // Étape 3: Associer les résultats agrégés aux utilisateurs et filtrer ceux sans commandes
          users.forEach(user => {
            
           // console.log(user);
            
           
            
            const order = orders.find(o => o._id.toString() === user._id.toString());
            const totalSum = order ? order.totalAmount + order.totalRest : 0;
            
             if(user && user.name == "Konate"){
              
                console.log( "l'order dit quoi ?", order);
               console.log(totalSum);
            }
    
            // Ajouter uniquement les utilisateurs avec des commandes valides
            if (totalSum > 0) {
              usersWithOrders.push({ name: user.name, id: user._id, sum: totalSum });
            }
          });
    
          // Ajuster le skip pour le prochain lot uniquement si des utilisateurs valides ont été trouvés
          skip += limit;  
        }
    
        // Limiter les résultats au maximum de 10
        console.log(usersWithOrders.length);
       // usersWithOrders = usersWithOrders.slice(0, limit);
    
        // Calculer le prochain skip à renvoyer
        const nextSkip = usersWithOrders.length >= limit ? skip : null;
    
       // console.log("le skip est " + nextSkip);
    
        res.status(200).json({ status: 0, list: usersWithOrders, skip: nextSkip });
        
      } catch (err) {
        console.log(err);
        res.status(505).json({ err });
      }
    };
    

exports.getList = async (req, res) => {
 
  

  try {
    const userFilter = {};
    if (req.body.status == "rec") {
      userFilter.rec_id = req.auth.userId;
    } else if (req.body.status == "agg") {
      userFilter.agg_id = req.auth.userId;
    }

    const limit = 10;
    let skip = req.body.skip || 0;
    let usersWithOrders = [];
    let hasMoreUsers = true;
    
  //  console.log("On demarre avec Skip " + skip);

    while (usersWithOrders.length < limit && hasMoreUsers) {
      // Étape 1: Récupérer un lot d'utilisateurs avec pagination et tri
      const users = await User.find(userFilter)
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      if (users.length === 0) {
        hasMoreUsers = false;
        break;
      }

      // Obtenir les user_id
      const userIds = users.map(user => user._id.toString());

      // Étape 2: Agréger les commandes pour ces utilisateurs
      const orders = await Order.aggregate([
        {
          $match: {
            agent_id: { $in: userIds },
            status: { $in: ["partial", "initial"] }
          }
        },
        {
          $group: {
            _id: "$agent_id", // Grouper par utilisateur
            totalAmount: {
              $sum: {
                $cond: { if: { $eq: ["$status", "initial"] }, then: "$amount", else: 0 }
              }
            },
            totalRest: {
              $sum: {
                $cond: { if: { $eq: ["$status", "partial"] }, then: "$rest", else: 0 }
              }
            }
          }
        }
      ]);

      // Étape 3: Associer les résultats agrégés aux utilisateurs et filtrer ceux sans commandes
      users.forEach(user => {
        
       // console.log(user);
        
       
        
        const order = orders.find(o => o._id.toString() === user._id.toString());
        const totalSum = order ? order.totalAmount + order.totalRest : 0;
        
         if(user && user.name == "Konate"){
          
            console.log( "l'order dit quoi ?", order);
           console.log(totalSum);
        }

        // Ajouter uniquement les utilisateurs avec des commandes valides
        if (totalSum > 0) {
          usersWithOrders.push({ name: user.name, id: user._id, sum: totalSum });
        }
      });

      // Ajuster le skip pour le prochain lot uniquement si des utilisateurs valides ont été trouvés
      skip += limit;  
    }

    // Limiter les résultats au maximum de 10
    console.log(usersWithOrders.length);
   // usersWithOrders = usersWithOrders.slice(0, limit);

    // Calculer le prochain skip à renvoyer
    const nextSkip = usersWithOrders.length >= limit ? skip : null;

   // console.log("le skip est " + nextSkip);

    res.status(200).json({ status: 0, list: usersWithOrders, skip: nextSkip });
    
  } catch (err) {
    console.log(err);
    res.status(505).json({ err });
  }
};

exports.addAgentOrder = async (req, res) => {
  
    const user =  await User.findOne({_id: req.body._id})
          
      try{
        
    const order = new Order({
      
      amount: parseInt(req.body.amount),
      phone: req.body.phone,
      type: req.body.type, 
      status: req.body.status,
      agent_id: req.body._id,
      read: false, 
      date: new Date()
        
    });
        
        
        await order.save(); 
        res.status(201).json({status: 0});
        
      }catch(err){
        
        console.log(err); 
        res.status(505).json({err})
      }
          
          
}

exports.addOrder = async (req, res) => {
  
    
    const user = await User.findOne({_id: req.body._id})
  
    const order = new Order({
      
      amount: parseInt(req.body.amount),
      phone: req.body.phone,
      rec_id: user.rec_id, 
      agg_id: user.agg_id, 
      type: req.body.type, 
      status: req.body.goodPhone ? "order" : "initial", 
      agent_id: req.body._id,
      read: false, 
      date: new Date()
        
    }); 
  
  
    order.save().then(() => {
     
      res.status(201).json({status: 0});
        
    }, (err) => {
      
        console.log(err); 
      res.status(505).json({err})
    })
  
}

exports.checkSendSMS = async (req, res) => {
  
console.log("on teste l'envoi", req.body);
  
  let body ; 
  let short; 
    let amount;
  
  if(req.body.type == "am") {
    

      short = {amBalance: parseInt(req.body.balance)}
      amount = parseInt(req.body.amount);
      
  }
  
  if(req.body.type == "mm") {
    

      short = {mmBalance: parseInt(req.body.balance)}
      amount = parseInt(req.body.amount);
  }
  
  if(req.body.type == "flash") {
    
    
      console.log("c'est l'heure de l'envoi", req.body);
      short = {flashBalance: parseInt(req.body.balance)}
      amount = (parseInt(req.body.amount)/10500) * 10000;
  }
  
  if(req.body.type == "express") {

      short = {expressBalance: parseInt(req.body.balance)}
      amount = (parseInt(req.body.amount)/10550) * 10000;
  }
  
  
  if(req.body.type !== "express" && req.body.type !== "flash"){
    
         await User.updateOne({_id: req.auth.userId}, {$set: short});
   
  }
  

 
  
  
  
    Order.findOne({amount, read: false, type: req.body.type, phone: req.body.phone}).sort({date: -1}).limit(1).then((order) => {
      
      console.log("je vois", order);
      
      if(order){
        
        
          
        Order.updateOne({_id: order._id}, {$set: {read: true}}).then(() => {
          
          res.status(200).json({status: 0});
            
        }, (err) => {
      
        console.log(err); 
        res.status(500).json({err})
    })
          
      }else{
        
         res.status(200).json({status: 1});
          
      }
        
    }, (err) => {
      
        console.log(err); 
        res.status(500).json({err})
    })
}



exports.launchOrder = async (req, res) => {
  console.log(req.body);
  try {
    const user = await User.findById(req.auth.userId);
    const agg = await User.findById(user.agg_id);
    const { currentServicee, amount } = req.body;

    const nowHour = new Date().getHours() + 1;
    if (user.time !== 24 && (nowHour < 5 || nowHour > user.time)) {
      return res.status(200).json({
        status: 1,
        message: "Vous ne pouvez plus passer de commande à cette heure"
      });
    }

    const serviceBalances = {
      "Airtel Money": agg.amBalance,
      "Moov Money": agg.mmBalance,
      "Flash Airtel": agg.flashBalance
    };

    if (
      serviceBalances[currentServicee] !== undefined &&
      serviceBalances[currentServicee] < amount
    ) {
      return res.status(200).json({
        status: 1,
        message: "Le solde de votre agrégateur est insuffisant, contactez-le"
      });
    }

    const result = await Order.aggregate([
      {
        $match: {
          agent_id: req.auth.userId,
          status: { $in: ["partial", "initial"] }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "initial"] }, "$amount", 0]
            }
          },
          totalRest: {
            $sum: {
              $cond: [{ $eq: ["$status", "partial"] }, "$rest", 0]
            }
          }
        }
      }
    ]);

    const { totalAmount = 0, totalRest = 0 } = result[0] || {};
    const totalInProgress = totalAmount + totalRest;

    if ((parseInt(totalInProgress) + parseInt(amount)) > user.amount) {
      return res.status(200).json({
        status: 1,
        message: `Vous avez dépassé votre quota en commande, vous ne pouvez commander que ${parseInt(user.amount) - parseInt(totalInProgress)}`
      });
    }

    const serviceMap = {
      "Flash Airtel": { phone: user.flashPhone, type: "flash" },
      "Express": { phone: user.expressPhone, type: "express" },
      "Airtel Money": { phone: user.amPhone, type: "am" },
      "Moov Money": { phone: user.mmPhone, type: "mm" }
    };

    const service = serviceMap[currentServicee];
    if (!service) {
      return res.status(400).json({ status: 1, message: "Service non reconnu" });
    }

    const lastOrder = await Order.findOne({
      agent_id: req.auth.userId,
      type: service.type,
      phone: service.phone,
      amount: parseInt(amount),
    }).sort({ date: -1 });

    if (lastOrder) {
      const diffMinutes = (Date.now() - new Date(lastOrder.date).getTime()) / (1000 * 60);
      if (diffMinutes <= 10) {
        return res.status(201).json({
          status: 1,
          message: "Commande identique détectée, veuillez réessayer après 10 minutes"
        });
      }
    }

    const newOrder = new Order({
      amount: parseInt(amount),
      phone: service.phone,
      rec_id: user.rec_id,
      agg_id: user.agg_id,
      type: service.type,
      status: "order",
      agent_id: req.auth.userId,
      read: false,
      date: new Date()
    });

    await newOrder.save();
    return res.status(201).json({ status: 0 });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 1, message: "Erreur serveur" });
  }
};


exports.minutesTest = (req, res) => {
  
  console.log("c'est la minutes")
  
  Order.findOne({agent_id: req.body._id, type: req.body.type, amount: req.body.amount}).sort({date: -1}).limit(1).then((order) => {
    
    let diffInMinutes = 30;
    let diffInMilliseconds
    
    
    if(order){
      
            const date1 = new Date(order.date); 
            const date2 = new Date(); 
          
            diffInMilliseconds = Math.abs(date2 - date1);
            diffInMinutes = diffInMilliseconds / (1000 * 60);
        
    }else{
      
        order = {}; 
    }
    
    if(diffInMinutes < 10) {
      
      console.log(" C'est 1");
      
        res.status(200).json({status: 1})
      
    
    }else{
      
     
      console.log("C'est 2");
      res.status(200).json({status: 0})
      
    }
    
        
  }, (err) => {
    
      console.log(err); 
    res.status(500).json({err})
  })
  
          
          

          
     
}

exports.webSocketOrder =  (req, res) => {
  
  const changeStream = Order.watch();
  
  const wss = new WebSocket.Server({ port: 8080 });
  const clients = {};
  
    changeStream.on('change', async (change) => {
    if (change.operationType === 'insert') {
      
      const newOrder = change.fullDocument;

      // Obtenir l'ID de l'agg lié au pos
      const aggId = await Order.findOne({_id: newOrder.agent_id}); 
      

      // Envoyer un message via WebSocket à l'agg correspondant
      if (clients[aggId]) {
        clients[aggId].send(JSON.stringify({
          message: 'Nouvelle commande',
          order: newOrder
        }));
      }
    }
  });
  
  

  console.log('Change Stream configuré pour la collection Order');
  
  
  wss.on('connection', (ws, req) => {
  // Assurez-vous de vérifier l'identité et l'authentification des utilisateurs ici

  // Pour cet exemple, nous utilisons l'ID de l'agg comme identifiant
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const aggId = data.aggId; // ID de l'agg envoyé depuis le client

    // Associer le client WebSocket à l'aggId
    console.log("On regarde de près", data);
    
    clients[aggId] = ws;
  });
});
  
  
}

exports.getOrders = async (req, res) => {
  
  console.log(req.body);
  
    let body ; 
  
    if(req.body.userStatus === "pos"){
      
        body = {agent_id: req.auth.userId}
    }
  
     if(req.body.userStatus === "rec"){
       
        
        body = {rec_id: req.auth.userId}
    }
  
     if(req.body.userStatus === "agg"){
      
        body = {agg_id: req.auth.userId}
    }
  
    if(req.body.type && req.body.type !== "Tout"){
      
      body = {...body, type: req.body.type}
        
    }
  
  
    if(req.body.readsOnly){
      
            body = {...body, read: !req.body.readsOnly}
  
    }
  
    
   if(req.body.goToOrders){

     body = {...body, status: {$ne: "recovery"}} 
     
   }
  
    if(req.body._id){
      
        body = {...body, agent_id: req.body._id}
    }
  
  let more;
  
    if(req.body.retour){
      
        more = {status: "return" }
   
    }else{
      
        more = {status: {$ne: "return"}}
    }
  
  try{
  
    const resultat = await Order.aggregate([
      {
        $match: {$and: [body, more]} 
      },
      {
        $sort: {date: -1}
      },
      {
        $skip: req.body.startAt
      },
      {
        $limit: 10
      },
      {
        $addFields: {
          agentObjectId: {
            $toObjectId: '$agent_id'
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'agentObjectId',
          foreignField: '_id',
          as: 'user_info'
        }
      },
      {
        $unwind: {
          path: '$user_info',
          preserveNullAndEmptyArrays: true // Garde les commandes même sans user
        }
      },
      {
        // Utilisation de $ifNull pour garantir que 'user_info' est au moins un objet vide
        $addFields: {
          user_info: { $ifNull: ['$user_info', {}] }
        }
      },
      {
        $project: {
          _id: 1,
          agent_id: 1,
          user_info: 1, // Inclut user_info (soit l'objet correspondant, soit {})
          order: "$$ROOT"
        }
      }
    ]);
  
        const totals = await Order.aggregate([
      {
        $match: {
          ...body,
          $or: [
            { status: "initial" },
            { status: "partial" }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "initial"] },
                "$amount",
                0
              ]
            }
          },
          totalRest: {
            $sum: {
              $cond: [
                { $eq: ["$status", "partial"] },
                "$rest",
                0
              ]
            }
          }
        }
      }
    ]);
    
    const totals2 = await Order.aggregate([
      {
        $match: {
  
                $or:[
                  {agg_id: req.auth.userId}, 
                  {rec_id: req.auth.userId}, 
                  {agent_id: req.auth.userId}
                ]        
            
             
            
        }
      }, 
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "initial"] },
                "$amount",
                0
              ]
            }
          },
          totalRest: {
            $sum: {
              $cond: [
                { $eq: ["$status", "partial"] },
                "$rest",
                0
              ]
            }
          }
        }
      }
    ])
    
    let totals3 = [];
    
    if(req.body._id){
      

      
       totals3 = await Order.aggregate([
      {
        $match: {
          
          $and: [
            
             {
              
              agent_id: req.body._id
            },
            {
              $and: [
                    {status: "return"}, 
                    {$or: [{read: false}, {$and: [{read: true}, {rest : {$gt: 0} }]}]}
                  ]
            }
          
          ]

        }
      },
      {
        $group: {
          _id: null,
               totalReturn1: {

            $sum: {
              $cond: [
                  { $eq: ["$read", false] }, 
                "$amount",
                0
              ]
            }
          }, 
          totalReturn2: {
            $sum: {
              $cond: [
                { $eq: ["$read", true] },
                "$rest",
                0
              ]
            }
          }
        }
      }
    ]);
        
    }
    

    const recs = await User.find({status: "rec", agg_id: req.auth.userId});
      
      
 
      
    const start = new Date();
    const end = new Date();

    // Définir les heures pour début et fin de jour
    start.setUTCHours(0, 0, 0, 0); // Minuit de date1
    end.setUTCHours(23, 59, 59, 999); // Fin de date2

  console.log(start); 
  console.log(end);
  
  
  let final = [];
  
  for(let rec of recs){
        
        
    const pipeline3 = [
       {
        $match: {
          $and: [
            {'date': { $gte: start, $lte: end }},
            {author_id: rec._id.toString()}
          ]
             
        }
      }, 
      {
      $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }, // Calcule la somme du champ amount
        },
     },
    ]
    
    const pipeline4 = [
  {
    $match: {
      $and: [
        { date: { $gte: start, $lte: end } },
        { "recoveries.author_id": { $eq: rec._id.toString() } },
        { $or: [{ status: "partial" }, { status: "recovery" }] }
      ]
    }
  },
  {
    $group: {
      _id: null,
      totalAmount: {
        $sum: {
          $cond: [
            { $eq: ["$status", "partial"] }, // Condition pour "partial"
            { $subtract: ["$amount", "$rest"] }, // Somme pour "partial"
            "$amount" // Somme pour "recovery"
          ]
        }
      }
    }
  }
];
        
      const  pipeline2 = [
          {
      $match: {
        
        $and: [
          {'recoveries.date': { $gte: start, $lte: end }},
          {status: {$in: ['partial', "recovery"]}},
          {"recoveries.author_id": { $eq: rec._id.toString() }}, 
        ],
        
      }
    },
    {
      $unwind: '$recoveries', // Décompose le tableau recoveries
    },
        {
    $match: {
      "recoveries.author_id": { $eq: rec._id.toString() },
      "recoveries.date": { $gte: start, $lte: end},
    },
  },
  // Ajouter un champ converti pour `recoveries.amount` en tant que nombre
  {
    $addFields: {
      "recoveries.amountNumber": {
                $cond: {
          if: { $isNumber: "$recoveries.amount" },
          then: "$recoveries.amount",
          else: {
            $convert: {
              input: "$recoveries.amount",
              to: "double",
              onError: 0,
              onNull: 0
            }
          }
        }// Conversion en nombre flottant (peut utiliser $toInt pour nombre entier)
      }
    }
  },
    {
      $group: {
          _id: null,
          totalAmount: { $sum: '$recoveries.amountNumber' }, // Calcule la somme du champ amount
        },
    },
    ]

    const cashhh = await Cash.aggregate(pipeline3);
    const amount = await Order.aggregate(pipeline4)
    const last = await Order.aggregate(pipeline2);
    
    const cashhhh = cashhh.length > 0 ? cashhh[0].totalAmount : 0;
    const amountt = amount.length > 0 ? amount[0].totalAmount : 0;
    const lastt = last.length > 0 ? last[0].totalAmount : 0;
    //console.log("on cache", cash);
   // console.log("On amount", amount);
        
    final.push({name: rec.name, sum: lastt, retours: cashhhh})
      
      
  }


    


    const totalAmount = totals.length> 0 ? totals[0].totalAmount : 0;
    const totalRest = totals.length> 0 ? totals[0].totalRest : 0;
    
    const totalAmount2 = totals2.length> 0 ? totals2[0].totalAmount : 0;
    const totalRest2 = totals2.length> 0 ? totals2[0].totalRest : 0;
    const totalReturn1 = totals3.length > 0 ? totals3[0].totalReturn1 : 0;
    const totalReturn2 = totals3.length > 0 ? totals3[0].totalReturn2 : 0;
    
   // console.log(resultat);
    console.log("la une", totalReturn1)
    console.log("la 2", totalReturn2)
    console.log("c'est l'Id", req.body._id)


    res.status(200).json({status: 0, orders: resultat, startAt: resultat.length === 10 ? parseInt(req.body.startAt) + 
                             10 : null, amount: totalAmount + totalRest, amount2:  totalAmount2 + totalRest2, amount3: totalReturn1 +  totalReturn2, final}); 
    
    
}catch(e){
  
  console.log(e); 
  res.status(500).json(e)
}

}

exports.recoveryAll = async (req, res) => {
  
    //const 
  
  
  try{

    const userrr = await User.findOne({_id: req.auth.userId})
    
    if(userrr.status === "agg" || userrr.status === "rec"){
    
    const orders = await Order.find({$and: [{$or: [{status: "initial"}, {status: "partial"}]}, {$or: [{type: "am"}, {type: "mm"}]}, 
                                           {agent_id: req.body._id}] }); 
    

    for(let order of orders){
      
    const recovery = {
      
        author_id: req.auth.userId, 
        amount: order.status === "initial" ? order.amount : order.rest, 
        date: new Date()
    }
    
      
        if(order.recoveries){
          
          order.recoveries.push(recovery)
            
        }else{
          
           order.recoveries = [recovery];  
        }
      
        if(order.status === "partial"){
            
            order.rest = 0;
           
        }
      
         order.status = 'recovery'
      
      
        await Order.updateOne({_id: order._id}, {$set: order} ); 
      
    }
    
    
    res.status(201).json({status: 0});
    
  }else{

    res.status(201).json({status: 1});

  }
    
  }catch(e){
    
      console.log(e); 
      res.status(500).json({e})
  }
    
}

exports.toRecovery = (req, res) => {
  
    Order.findOne({_id: req.body._id}).then((order) => {
      
      if(order.status == "initial"){
        
          if(order.amount == req.body.amount){
            
            order.status = "recovery"; 
            
              
          }else{
            
            order.status = "partial"; 
            order.rest = parseInt(order.amount) - parseInt(req.body.amount);
            
          }
      
      }else{
        
        if(order.rest == req.body.amount){
          
            order.status = "recovery"; 
            order.rest = 0; 
          
        }else{
          
            order.rest = parseInt(order.rest) - parseInt(req.body.amount)
        }
          
      }
      
      const recovery = {
      
        author_id: req.auth.userId, 
        amount: req.body.amount, 
        date: new Date()
    
      }
      
      if(order.recoveries){
        
          order.recoveries.push(recovery);
      
      }else{
        
          order.recoveries = [recovery]
      }
      
      Order.updateOne({_id: order._id}, {$set: order}).then(() => {
        
        res.status(201).json({status: 0});
          
      }, (err) => {
      
        console.log(err); 
        res.status(505).json({err})
    })
      
      
        
    }, (err) => {
      
        console.log(err); 
        res.status(505).json({err})
    })
}

exports.getPendingOrders = (req, res) => {
  
    Order.find({agg_id: req.auth.userId, status: "order"}).sort({date: -1}).limit(2).then(async (orders) => {
      
     // console.log(order); 
      
        if(orders[0]){
          
          let diffInMinutes = 0;
          let diffInMinutes2 = 0;
          let diffInMilliseconds
          
      
            const date1 = new Date(orders[0].date); 
            const date2 = new Date(); 
          
            diffInMilliseconds = Math.abs(date2 - date1);
            diffInMinutes = diffInMilliseconds / (1000 * 60);
            
            
            if(orders[1]){
              
                          
                const date3 = new Date(orders[1].date); 
                let diffInMilliseconds2 = Math.abs(date1 - date3) ; 
                diffInMinutes2 = diffInMilliseconds2 / (1000 * 60);
              
            }
          
          
      if(orders[1]){
            
        if((diffInMinutes2 < 10) && (orders[0].amount == orders[1].amount && orders[0].type == orders[1].type && orders[0].agent_id == orders[1].agent_id)){
            
            await Order.deleteOne({_id: orders[1]._id});
            res.status(201).json({status: 0})
          
          }else{
            
         if(diffInMinutes >= 10){
            
            await Order.deleteOne({_id: orders[0]._id});
            res.status(201).json({status: 0})
          
          }else{
            
            /*  if(orders[0].amount == orders[1].amount && orders[0].type == orders[1].type && orders[0].agent_id == orders[1].agent_id
                && 1){
                
                  
              }else{
                
                
              } */
            
              console.log("C'est trop bien ");
              res.status(201).json({status: 0, order: orders[0]});
              
          }
              
          }
            
            
          }else{
            
          if(diffInMinutes >= 10){
            
            await Order.deleteOne({_id: orders[0]._id});
            res.status(201).json({status: 0})
          
          }else{
            
            /*  if(orders[0].amount == orders[1].amount && orders[0].type == orders[1].type && orders[0].agent_id == orders[1].agent_id
                && 1){
                
                  
              }else{
                
                
              } */
            
              console.log("C'est trop bien ");
              res.status(201).json({status: 0, order: orders[0]});
              
          }
            
              
          }
   
          
          
          

        // Convertissez la différence en minutes
         
          
        

      
          
        }else{
          
            res.status(200).json({status: 0});
        }
      

          
        
        
    }, (err) => {
      
        console.log(err); 
        res.status(505).json({err})
    })
  
}

exports.updateOrderr = (req, res) => {
  
    Order.updateOne({_id: req.body._id}, {$set: {status: "initial"}}).then(() => {
      
        res.status(200).json({status: 0})
    
    }, (err) => {
      
        console.log(err); 
        res.status(505).json({err})
    })
}


function parseDate(dateString) {
  const [datePart, timePart] = dateString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = (timePart.split('.')[0] || '00:00:00').split(':').map(Number);

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
}


exports.getReports = async (req, res) => {
  
  console.log(req.body.date1); 
  console.log(req.body.date2)
  
  const start = new Date(req.body.date1);
  const end = new Date(req.body.date2);

  // Définir les heures pour début et fin de jour
  start.setUTCHours(0, 0, 0, 0); // Minuit de date1
  end.setUTCHours(23, 59, 59, 999); // Fin de date2
  
  console.log(start);
  console.log(end);
  console.log(req.body)
  let type; 
  
  if(req.body.name == "Airtel Money"){
    
      type = "am"
  }
  
    if(req.body.name == "Moov Money"){
    
      type = "mm"
  }
  
    if(req.body.name == "Express"){
    
      type = "express"
  }
  
    if(req.body.name == "Flash"){
    
      type = "flash"
  }
  
    let pipeline; 
    let pipeline2;
  
  try{
    

    
    if(req.body.read){
      
     pipeline = [
    {
      $match: {
        
        $and: [
          {"recoveries.date": {$gte: start}}, 
          {"recoveries.date": {$lte: end}},
          {type},
          {read: true},
          {status: {$in: ['partial', "recovery"]}},
          {"recoveries.author_id": req.body._id}, 
          
        ],
      
      }
    }, 
    {
      $sort: {date: -1}
    }, 
    {
      $skip: req.body.startAt
    }, 
    {
      $limit: 10
    }, 
          {
        $addFields: {
          agentObjectId: {
            $toObjectId: '$agent_id'
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'agentObjectId',
          foreignField: '_id',
          as: 'user_info'
        }
      },
      {
        $unwind: {
          path: '$user_info',
          preserveNullAndEmptyArrays: true // Si vous voulez inclure les commandes sans utilisateur associé
        }
      },
  ];
    
     pipeline2 = [
          {
      $match: {
        
        $and: [
          {"recoveries.date": { $gte: start, $lte: end }},
          {type},
          {read: true},
          {status: {$in: ['partial', "recovery"]}},
          {"recoveries.author_id": req.body._id}, 
        ],
        
      }
    },
    {
      $unwind: '$recoveries', // Décompose le tableau recoveries
    },
        {
    $match: {
      "recoveries.author_id": req.body._id,
       "recoveries.date": { $gte: start, $lte: end},
    },
  },
  // Ajouter un champ converti pour `recoveries.amount` en tant que nombre
  {
    $addFields: {
      "recoveries.amountNumber": {
        $cond: {
          if: { $isNumber: "$recoveries.amount" },
          then: "$recoveries.amount",
          else: {
            $convert: {
              input: "$recoveries.amount",
              to: "double",
              onError: 0,
              onNull: 0
            }
          }
        } // Conversion en nombre flottant (peut utiliser $toInt pour nombre entier)
      }
    }
  },
    {
      $group: {
          _id: null,
          totalAmount: { $sum: '$recoveries.amountNumber' }, // Calcule la somme du champ amount
        },
    },
    ]

    }else{
      
  
  pipeline = 
    [
    {
      $match: {
        
        $and: [
          {"recoveries.date": {$gte: start}}, 
          {"recoveries.date": {$lte: end}},
          {type},
          {status: {$in: ['partial', "recovery"]}},
          {"recoveries.author_id": req.body._id}, 
        ],
        
      }
    }, 
    {
      $sort: {date: -1}
    }, 
    {
      $skip: req.body.startAt
    }, 
    {
      $limit: 10
    }, 
          {
        $addFields: {
          agentObjectId: {
            $toObjectId: '$agent_id'
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'agentObjectId',
          foreignField: '_id',
          as: 'user_info'
        }
      },
      {
        $unwind: {
          path: '$user_info',
          preserveNullAndEmptyArrays: true // Si vous voulez inclure les commandes sans utilisateur associé
        }
      },
  ];
    
     pipeline2 = [
          {
      $match: {
        
        $and: [
          {'recoveries.date': { $gte: start, $lte: end }},
          {type},
          {status: {$in: ['partial', "recovery"]}},
          {"recoveries.author_id": req.body._id}, 
        ],
        
      }
    },
    {
      $unwind: '$recoveries', // Décompose le tableau recoveries
    },
        {
    $match: {
      "recoveries.author_id": req.body._id,
      "recoveries.date": { $gte: start, $lte: end},
    },
  },
  // Ajouter un champ converti pour `recoveries.amount` en tant que nombre
  {
    $addFields: {
      "recoveries.amountNumber": {
                $cond: {
          if: { $isNumber: "$recoveries.amount" },
          then: "$recoveries.amount",
          else: {
            $convert: {
              input: "$recoveries.amount",
              to: "double",
              onError: 0,
              onNull: 0
            }
          }
        }// Conversion en nombre flottant (peut utiliser $toInt pour nombre entier)
      }
    }
  },
    {
      $group: {
          _id: null,
          totalAmount: { $sum: '$recoveries.amountNumber' }, // Calcule la somme du champ amount
        },
    },
    ]
      
        
    }
    
    
    const pipeline3 = [
       {
        $match: {
          $and: [
            {'date': { $gte: start, $lte: end }},
            {author_id: req.body._id}
          ]
             
        }
      }, 
      {
      $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }, // Calcule la somme du champ amount
        },
     },
    ]

    const cash = await Cash.aggregate(pipeline3);
    
    const cashh = cash.length > 0 ? cash[0].totalAmount : 0;
    
    console.log("on cache", cash);
    
    const result = await Order.aggregate(pipeline);
    
    const result2 = await Order.aggregate(pipeline2);
    
    console.log(result2);
   // console.log(result[0].recoveries);
    
     
    res.status(200).json({orders: result, status: 0, startAt: result.length === 10 ? parseInt(req.body.startAt) + 10 : null, 
                         amount: result2.length > 0 ? result2[0].totalAmount: 0, cash: cashh});
    
    
  }catch(e){
    
      console.log(e); 
    res.status(500).json({e})
  }
  
    
}

exports.deleteOrder = (req, res) => {
  
    Order.findOne({_id: req.body._id}).then(  (order) => {
      
      console.log(order); 
      
      const deletedOrder = new Deletedorder({
          amount: order.amount, 
          agent_id: order.agent_id, 
          agg_id: order.agg_id, 
          type: order.type, 
          phone: order.phone, 
          deleted_date: new Date(), 
          date: order.date, 
          deleter_id: req.auth.userId
      }); 
      
    
      
      deletedOrder.save().then(async () => {
        
        await Order.deleteOne({_id: order._id});
        
        res.status(200).json({status: 0});
          
      }, (err) => {
        
          console.log(err); 
          res.status(505).json({err})
      })
      
      
        
    }, (err) => {
      
        res.status(505).json({err})
    })
}

function testCombinaisons(objects, targetSum) {
    function backtrack(index, currentSum, combination) {
      if (currentSum === targetSum) return combination;
      if (currentSum > targetSum || index >= objects.length) return null;
  
      const current = objects[index];
      const amount = current.rest !== undefined && current.rest < current.amount ? current.rest : current.amount;
  
      const withCurrent = backtrack(index + 1, currentSum + amount, [...combination, current]);
      if (withCurrent) return withCurrent;
  
      return backtrack(index + 1, currentSum, combination);
    }
  
    return backtrack(0, 0, []);
  }
  
  function testCombinaisons2(objects, targetSum) {
    function backtrack(index, currentSum, combination) {
      if (currentSum === targetSum) return combination;
      if (currentSum > targetSum || index >= objects.length) return null;
  
      const current = objects[index];
      const amount = current.rest !== undefined && current.rest > 0 ? current.rest : current.amount;
  
      const withCurrent = backtrack(index + 1, currentSum + amount, [...combination, current]);
      if (withCurrent) return withCurrent;
  
      return backtrack(index + 1, currentSum, combination);
    }
  
    return backtrack(0, 0, []);
  }
  
  function countAmountsToTarget(orders, targetSum) {
    let accumulated = 0;
    const result = [];
  
    for (const o of orders) {
      const order = { ...o.toObject?.() ?? o };
      const amount = order.rest !== undefined ? order.rest : order.amount;
  
      if (accumulated + amount > targetSum) {
        const used = targetSum - accumulated;
        order.rest = amount - used;
        result.push(order);
        accumulated += used;
        break;
      } else {
        accumulated += amount;
        result.push(order);
      }
    }
  
    return accumulated === targetSum ? result : [];
  }
  
  function countAmountsToTarget2(orders, targetSum) {
    let accumulated = 0;
    const result = [];
  
    for (const o of orders) {
      const order = { ...o.toObject?.() ?? o };
      const amount = order.rest !== undefined ? order.rest : order.amount;
  
      if (accumulated + amount > targetSum) {
        const used = targetSum - accumulated;
        order.rest2 = amount - used;
        result.push(order);
        accumulated += used;
        break;
      } else {
        accumulated += amount;
        result.push(order);
      }
    }
  
    return accumulated === targetSum ? result : [];
  }
  
  function findClosestCombination(orders, targetSum) {
    function backtrack(index, currentSum, combination) {
      if (index >= orders.length) {
        return { combination, sum: currentSum };
      }
  
      const current = orders[index];
      const amount = current.rest !== undefined && current.rest > 0 ? current.rest : current.amount;
  
      const include = backtrack(index + 1, currentSum + amount, [...combination, current]);
      const exclude = backtrack(index + 1, currentSum, combination);
  
      if (!include) return exclude;
      if (!exclude) return include;
  
      return include.sum > exclude.sum && include.sum < targetSum ? include : exclude;
    }
  
    const result = backtrack(0, 0, []);
    const rest = targetSum - (result?.sum || 0);
  
    return {
      array: result?.combination || [],
      rest,
    };
  }

exports.manageReturns = async (req, res, next) => {
  
    //console.log(req.body);
  
  console.log("est ce que c'est deux fois ?", req.body);
  
  
  
    try{
      
      let short; 
      let balance; 
      
      if(req.body.type == "am"){
        
          short = {amPhone: req.body.phone, agg_id: req.auth.userId}
          balance = {amBalance: req.body.balance}
          
      }
      
       if(req.body.type == "mm"){
        
          short = {mmPhone: req.body.phone, agg_id: req.auth.userId}
          balance = {mmBalance: req.body.balance}
      }
      
       if(req.body.type == "flash"){
        
          short = {flashPhone: req.body.phone, agg_id: req.auth.userId}
          balance = {flashBalance: req.body.balance}
      }
      
       if(req.body.type == "express"){
        
          short = {expressPhone: req.body.phone, agg_id: req.auth.userId}
          balance = {expressBalance: req.body.balance}
      }
      
      
     const user = await  User.findOne(short); 
      
      console.log("l'utilisateur", user);
      
    
      if(user && user !== null && req.body.balance && req.body.amount && req.body.amount !== req.body.balance){
        
          await User.updateOne({_id: user._id}, {$set: balance}); 
      
      }
      
      
      
      
      
      
      if(user && req.auth.userId !== "671a680fcac48fc7075f1ff2"){
        
       // console.log(user);
        
        const order = await Order.findOne({type: req.body.type, phone: req.body.phone, amount: req.body.amount, status: "return"}).sort({date: - 1}); 
        
            let diffInMinutes = 0;
            let diffInMinutes2 = 0;
            let diffInMilliseconds;
        
        if(order){
          
          console.log("Oui gué c'est fou", order); 
          
            const date1 =  new Date(order.date);  
        
            
            const date2 = new Date(); 
          
            diffInMilliseconds = Math.abs(date2 - date1);
            diffInMinutes = diffInMilliseconds / (1000 * 60);
          
            console.log("les minutes", diffInMinutes);
          
            if(diffInMinutes < 1){
              
              
                 console.log("c'est un doublon");
                 res.status(200).json({status: 5}); 


                
            }else{


                const orders = await Order.find({agent_id: user._id, status: {$in: ["initial", 'partial']}, type: {$in: ["am", "mm"]}}).sort({date: -1}); 
          
                console.log("on met le faya"); 
                
                const initials = orders.filter(item => item.status == "initial"); 
                const partials = orders.filter(item => item.status == "partial");
                
                let finalOrders = [];
                
                if(initials.length > 0 && initials.filter(item => parseInt(item.amount) == parseInt(req.body.amount)).length > 0){
                  
                 
                  
                    const orderr = initials.filter(item => parseInt(item.amount) == parseInt(req.body.amount))[0]; 
                    
                    console.log("C'est le One", orderr);
                  
                          const recovery = {
            
                                      author_id: user.agg_id, 
                                      amount: req.body.amount, 
                                      date: new Date(), 
                                      return: true
      
                                    }
                  
                    await Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", recoveries: [recovery]}}); 
                  
                        const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                            message: `Utilisé en retour complet pour la commande ${orderr.type} de ${req.body.amount} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()} à ${new Date(orderr.date).getHours()}h:${new Date(orderr.date).getHours()}mn`
      
                          });
                  
                  await newOrder.save(); 
                  
                  res.status(201).json({status: 0});
                  
                
                  
                  next();
                    
                
                }else if(initials.length > 0 && testCombinaisons(initials, parseInt(req.body.amount) ) && testCombinaisons(initials, parseInt(req.body.amount) ).length > 0){
                  
                
                  
                  const orderrs = testCombinaisons(initials, parseInt(req.body.amount)); 
                  
                  //console.log(orders); 
                    console.log("c'est par ici", orderrs);
                  
                  for(let orderr of orderrs){
                    
                      const recovery = {
            
                                      author_id: user.agg_id, 
                                      amount: req.body.amount, 
                                      date: new Date(), 
                                      return: true
      
                                    }
                                      
                       await  Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", recoveries: [recovery]}})
                  
                  }
                  
                        const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                           // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                            message: `Utilisé en retour complet pour les commandes : ${orderrs.map(item => {
        const date = new Date(item.date);
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
        return `la commande ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
      }).join(', ')}`
                          });
                  
                  await newOrder.save(); 
                  
                 // console.log("On est dans le 2 x 2 ")
                  
                  res.status(201).json({status: 0});
                  
              
                  next();
                    
                }else if(partials.length > 0 && partials.filter(item => parseInt(item.rest) == parseInt(req.body.amount)).length > 0){
                  
                  
                    const orderr = partials.filter(item => parseInt(item.rest) == parseInt(req.body.amount))[0]; 
                    
                   console.log("C'est le One partial", orderr);
                  
                          const recovery = {
            
                                      author_id: user.agg_id, 
                                      amount: orderr.rest, 
                                      date: new Date(), 
                                      return: true
      
                                    }
                          
                      const recoveries = orderr.recoveries; 
                      recoveries.push(recovery);
                  
                    await Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", rest: 0,  recoveries}}); 
                  
                        const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                            message: `Utilisé en retour pour boucler avec ${orderr.rest} Fcfa la commande ${orderr.type} de ${orderr.amount} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()} à ${new Date(orderr.date).getHours()}h:${new Date(orderr.date).getHours()}mn`
      
                          });
                  
                  await newOrder.save(); 
                  
                  res.status(201).json({status: 0});
                    
                
                    next();
                
                }else if(partials.length > 0 && testCombinaisons(partials, parseInt(req.body.amount) ) && testCombinaisons(partials, parseInt(req.body.amount) ).length > 0){
                  
                  //console.log("c'est par ici");
                  
                  
                  const orderrs = testCombinaisons(partials, parseInt(req.body.amount)); 
                  
                //  console.log(orders); 
                     console.log("C'est le two partial", orderrs);
                  
                  for(let orderr of orderrs){
                    
                      const recovery = {
            
                                      author_id: user.agg_id, 
                                      amount: orderr.rest, 
                                      date: new Date(), 
                                      return: true
      
                                    }
                      
                      const recoveries = orderr.recoveries; 
                      recoveries.push(recovery);
                      
                      
                                      
                       await  Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", rest: 0, recoveries}})
                  
                  }
                  
                        const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                           // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                            message: `Utilisé en retour complet pour les restes des commandes : ${orderrs.map(item => {
                              const date = new Date(item.date);
                              const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                              return `Recouvrement du reste de ${item.rest} Fcfa de la commande ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                            }).join(', ')}`
                                                });
      
                                        await newOrder.save(); 
      
                                        //console.log("On est dans le 2 x 2 ")
      
                                        res.status(201).json({status: 0});
      
                                        
                                   
                                        next();
                    
                
                }else if(orders.length > 0 && testCombinaisons2(orders, parseInt(req.body.amount)) && testCombinaisons2(orders, parseInt(req.body.amount)).length > 0){
                  
                  const orderrs = testCombinaisons2(orders, parseInt(req.body.amount)); 
                  
                              for(let orderr of orderrs){
                    
                      const recovery = {
            
                                      author_id: user.agg_id, 
                                      amount: orderr.rest && orderr.rest > 0 ? orderr.rest : orderr.amount, 
                                      date: new Date(), 
                                      return: true
      
                                    }
                      
                      const recoveries = orderr.recoveries ? orderr.recoveries : []; 
                      recoveries.push(recovery);
                      
                      
                                      
                       await  Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", rest: 0, recoveries}})
                  
                  }
                  
                        const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                           // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                            message: `Utilisé en retour complet pour les commandes : ${orderrs.map(item => {
                              const date = new Date(item.date);
                              const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                              return `Recouvrement ${item.rest && item.rest > 0 ? " du reste de "+ item.rest +"Fcfa de " : "de"} la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                            }).join(', ')}`
                                                });
      
                                        await newOrder.save(); 
      
                                        //console.log("On est dans le 2 x 2 ")
      
                                        res.status(201).json({status: 0});
      
                                      
                                        next();
                  
                  
      
                    
                  
                  
                }else if(initials.length > 0 && countAmountsToTarget(initials, parseInt(req.body.amount)) && countAmountsToTarget(initials, parseInt(req.body.amount)).length > 0){
                  
            
                  
                  const orderrs = countAmountsToTarget(initials, parseInt(req.body.amount)); 
                        console.log("c'est la magie", orderrs);
                  
                  for(let orderr of orderrs){
                    
                                      const recovery = {
            
                                      author_id: user.agg_id, 
                                      amount: orderr.rest && orderr.rest > 0 ? parseInt(orderr.amount) - parseInt(orderr.rest) : orderr.amount, 
                                      date: new Date(), 
                                      return: true
      
                                    }
                      
             
                      
                      
                                      
                       await  Order.updateOne({_id: orderr._id}, {$set: {status: orderr.rest && orderr.rest > 0 ? "partial" : "recovery", rest: orderr.rest && orderr.rest > 0 ? orderr.rest : 0, recoveries: [recovery]}})
                  }
                  
                          const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                           // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                            message: `Utilisé en retour pour les commandes : ${orderrs.map(item => {
                              const date = new Date(item.date);
                              const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                              return `Recouvrement ${item.rest && item.rest > 0 ? " partiel de "+  `${(parseInt(item.amount) - parseInt(item.rest))}` + "Fcfa de " : "de"} la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                            }).join(', ')}`
                                                });
                  
                  
                          await newOrder.save();  
                          res.status(201).json({status: 0});
      
                    
                          next();
                  
                  
                }else if(partials.length > 0 && countAmountsToTarget2(partials, parseInt(req.body.amount)) && countAmountsToTarget2(partials, parseInt(req.body.amount)).length > 0){
                  
            
                  const orderrs = countAmountsToTarget2(partials, parseInt(req.body.amount)); 
                        console.log("c'est la seconde magie magie", orderrs);
                  
                  for(let orderr of orderrs){
                    
                                    const recovery = {
            
                                      author_id: user.agg_id, 
                                      amount: orderr.rest2 && orderr.rest2 > 0 ? (parseInt(orderr.rest) - parseInt(orderr.rest2)) : orderr.rest, 
                                      date: new Date(), 
                                      return: true
      
                                    }
                                      
                                const recoveries =  orderr.recoveries; 
                                recoveries.push(recovery);
                      
             
                      
                      
                                      
                       await  Order.updateOne({_id: orderr._id}, {$set: {status: orderr.rest2 && orderr.rest2 > 0 ? "partial" : "recovery", rest: orderr.rest2 && orderr.rest2 > 0 ?  parseInt(orderr.rest2) : 0, recoveries}})
                  }
                  
                          const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                           // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                            message: `Utilisé en retour pour les commandes : ${orderrs.map(item => {
                              const date = new Date(item.date);
                              const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                              return `Recouvrement  ${item.rest2 && item.rest2 > 0 ? "partiel de " + `${(parseInt(item.rest) - parseInt(item.rest2))}` +" Fcfa de " : "de "+ item.rest + "Fcfa pour boucler " }  la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                            }).join(', ')}`
                                                });
                  
                  
                          await newOrder.save();  
                          res.status(201).json({status: 0});
      
           
                  next();
                  
                  
                }else if(orders.length > 0 && countAmountsToTarget2(orders, parseInt(req.body.amount)) && countAmountsToTarget2(orders, parseInt(req.body.amount)).length > 0){
                  
                              const orderrs = countAmountsToTarget2(orders, parseInt(req.body.amount)); 
                              
                              console.log("c'est la troisième magie", orderrs);
                  
                              for(let orderr of orderrs){
                                
                                  const recovery = {
                                      author_id: user.agg_id, 
                                      amount: (orderr.rest && orderr.rest > 0) ? orderr.rest2 && orderr.rest2 > 0 ?  (parseInt(orderr.rest) - parseInt(orderr.rest2)) : orderr.rest : orderr.rest2 && orderr.rest2 > 0 ? (parseInt(orderr.amount) - parseInt(orderr.rest2)) : orderr.amount , 
                                      date: new Date(), 
                                      return: true
                                  }
                                  
                                const recoveries = orderr.rest && orderr.rest > 0 ? orderr.recoveries : [] ; 
                                
                                recoveries.push(recovery);
                                
                                await  Order.updateOne({_id: orderr._id}, {$set: {status: orderr.rest2 && orderr.rest2 > 0 ? "partial" : "recovery", rest: (orderr.rest && orderr.rest > 0) ? orderr.rest2 && orderr.rest2 > 0 ? parseInt(orderr.rest) - parseInt(orderr.rest2) : 0 : orderr.rest2 && orderr.rest2 > 0 ? parseInt(orderr.amount) - parseInt(orderr.rest2) : 0 , recoveries}})
                      
                              }
                  
                          const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                           // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                            message: `Utilisé en retour pour les commandes : ${orderrs.map(item => {
                              const date = new Date(item.date);
                              const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                              return `Recouvrement ${item.rest2 && item.rest2 > 0 ? " partiel de "+ `${item.rest && item.rest > 0 ? (parseInt(item.rest) - parseInt(item.rest2)) : (parseInt(item.amount) - parseInt(item.rest2)) }` +"Fcfa de " : "de"} la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                            }).join(', ')}`
                                                });
                  
                  
                          await newOrder.save();  
                          res.status(201).json({status: 0});
      
             
                  next();
                  
                  
                }else if(orders.length > 0 && findClosestCombination(orders, parseInt(req.body.amount)).array.length > 0){
                  
                 // console.log("c'est le boss")
                  
                  const orderrs = findClosestCombination(orders, parseInt(req.body.amount)).array; 
                  const theAmount = findClosestCombination(orders, parseInt(req.body.amount)).rest; 
                  
                        for(let orderr of orderrs){
                                
                                  const recovery = {
                                      author_id: user.agg_id, 
                                      amount: (orderr.rest && orderr.rest > 0) ?  orderr.rest : orderr.amount, 
                                      date: new Date(), 
                                      return: true
                                  }
                                  
                                const recoveries = orderr.rest && orderr.rest > 0 ? orderr.recoveries : []; 
                                
                                recoveries.push(recovery);
                                
                                await  Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", rest: 0, recoveries}}); 
                          
                      
                              }
                  
                          const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                            rest: parseInt(theAmount),
                           // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                            message: `Utilisé en retour complet pour les commandes : ${orderrs.map(item => {
                              const date = new Date(item.date);
                              const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                              return `Recouvrement ${item.rest && item.rest > 0 ? "de "+ item.rest +  " Fcfa pour boucler " :  "de " } la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                            }).join(', ')}`
                                                });
                  
                  
                          await newOrder.save();  
                          res.status(201).json({status: 0});
                  
                
                        next();
                  
                  
                }else if(initials.length > 0 && initials.filter(item => parseInt(item.amount) > parseInt(req.body.amount)).length > 0){
                  
                    console.log("C'est la folie des initials");
                  
                  const orderr = initials.filter(item => parseInt(item.amount) > parseInt(req.body.amount))[0]; 
                  
                                      const recovery = {
            
                                      author_id: user.agg_id, 
                                      amount: req.body.amount, 
                                      date: new Date(), 
                                      return: true
      
                                    }
                                      
                       await  Order.updateOne({_id: orderr._id}, {$set: {status: "partial", rest: parseInt(orderr.amount) - parseInt(req.body.amount), recoveries: [recovery]}})
                  
                          const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                            message: `Utilisé en retour partiel pour la commande ${orderr.type} de  ${parseInt(orderr.amount)} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
      
                          });
                  
                  await newOrder.save(); 
                  
                  //console.log("On est dans le 2")
                  
                  res.status(201).json({status: 0});
                  
                    
                  next();
                  
                
                }else if(partials.length > 0 && partials.filter(item => parseInt(item.rest) > parseInt(req.body.amount)).length > 0){
                  
                     console.log("C'est le three partial");
                  
                    const orderr = partials.filter(item => parseInt(item.rest) > parseInt(req.body.amount))[0]; 
                  
                                      const recovery = {
            
                                      author_id: user.agg_id, 
                                      amount: req.body.amount, 
                                      date: new Date(), 
                                      return: true
      
                                    }
                                      
                                const recoveries = orderr.recoveries; 
                                recoveries.push(recovery)
                                      
                       await  Order.updateOne({_id: orderr._id}, {$set: {rest: parseInt(orderr.rest) - parseInt(req.body.amount) , recoveries}})
                  
                          const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: true, 
                            date: new Date(), 
                            message: `Utilisé en retour partiel pour la commande ${orderr.type} de ${parseInt(orderr.amount)} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
      
                          });
                  
                  await newOrder.save(); 
                  
                  //console.log("On est dans le 2")
                  
                  res.status(201).json({status: 0});
                  
                  
                  next();
                    
                
                }else{
                  
                       console.log("C'est le sinon partial");
                          const newOrder = new Order({
            
                            amount: parseInt(req.body.amount),
                            phone: req.body.phone,
                            rec_id: user.rec_id, 
                            agg_id: user.agg_id, 
                            type: req.body.type, 
                            status: "return", 
                            agent_id: user._id,
                            read: false, 
                            date: new Date(), 
                          //  message: `Utilisé en retour pour boucler avec ${orderr.rest} Fcfa la commande ${orderr.type} de ${orderr.amount} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()} à ${new Date(orderr.date).getHours()}h:${new Date(orderr.date).getHours()}mn`
      
                          });
                  
                  await newOrder.save(); 
                  
                  res.status(201).json({status: 0});
              
                  next()
                  
                  
                }
                

              
              
            }
          
        }else{


            const orders = await Order.find({agent_id: user._id, status: {$in: ["initial", 'partial']}, type: {$in: ["am", "mm"]}}).sort({date: -1}); 
          
            console.log("on met le faya"); 
            
            const initials = orders.filter(item => item.status == "initial"); 
            const partials = orders.filter(item => item.status == "partial");
            
            let finalOrders = [];
            
            if(initials.length > 0 && initials.filter(item => parseInt(item.amount) == parseInt(req.body.amount)).length > 0){
              
             
              
                const orderr = initials.filter(item => parseInt(item.amount) == parseInt(req.body.amount))[0]; 
                
                console.log("C'est le One", orderr);
              
                      const recovery = {
        
                                  author_id: user.agg_id, 
                                  amount: req.body.amount, 
                                  date: new Date(), 
                                  return: true
  
                                }
              
                await Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", recoveries: [recovery]}}); 
              
                    const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                        message: `Utilisé en retour complet pour la commande ${orderr.type} de ${req.body.amount} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()} à ${new Date(orderr.date).getHours()}h:${new Date(orderr.date).getHours()}mn`
  
                      });
              
              await newOrder.save(); 
              
              res.status(201).json({status: 0});
              
         
              next();
                
            
            }else if(initials.length > 0 && testCombinaisons(initials, parseInt(req.body.amount) ) && testCombinaisons(initials, parseInt(req.body.amount) ).length > 0){
              
            
              
              const orderrs = testCombinaisons(initials, parseInt(req.body.amount)); 
              
              //console.log(orders); 
                console.log("c'est par ici", orderrs);
              
              for(let orderr of orderrs){
                
                  const recovery = {
        
                                  author_id: user.agg_id, 
                                  amount: req.body.amount, 
                                  date: new Date(), 
                                  return: true
  
                                }
                                  
                   await  Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", recoveries: [recovery]}})
              
              }
              
                    const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                       // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                        message: `Utilisé en retour complet pour les commandes : ${orderrs.map(item => {
    const date = new Date(item.date);
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
    return `la commande ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
  }).join(', ')}`
                      });
              
              await newOrder.save(); 
              
             // console.log("On est dans le 2 x 2 ")
              
              res.status(201).json({status: 0});
              
           
              next();
                
            }else if(partials.length > 0 && partials.filter(item => parseInt(item.rest) == parseInt(req.body.amount)).length > 0){
              
              
                const orderr = partials.filter(item => parseInt(item.rest) == parseInt(req.body.amount))[0]; 
                
               console.log("C'est le One partial", orderr);
              
                      const recovery = {
        
                                  author_id: user.agg_id, 
                                  amount: orderr.rest, 
                                  date: new Date(), 
                                  return: true
  
                                }
                      
                  const recoveries = orderr.recoveries; 
                  recoveries.push(recovery);
              
                await Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", rest: 0,  recoveries}}); 
              
                    const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                        message: `Utilisé en retour pour boucler avec ${orderr.rest} Fcfa la commande ${orderr.type} de ${orderr.amount} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()} à ${new Date(orderr.date).getHours()}h:${new Date(orderr.date).getHours()}mn`
  
                      });
              
              await newOrder.save(); 
              
              res.status(201).json({status: 0});
                
          
              next();
            
            }else if(partials.length > 0 && testCombinaisons(partials, parseInt(req.body.amount) ) && testCombinaisons(partials, parseInt(req.body.amount) ).length > 0){
              
              //console.log("c'est par ici");
              
              
              const orderrs = testCombinaisons(partials, parseInt(req.body.amount)); 
              
            //  console.log(orders); 
                 console.log("C'est le two partial", orderrs);
              
              for(let orderr of orderrs){
                
                  const recovery = {
        
                                  author_id: user.agg_id, 
                                  amount: orderr.rest, 
                                  date: new Date(), 
                                  return: true
  
                                }
                  
                  const recoveries = orderr.recoveries; 
                  recoveries.push(recovery);
                  
                  
                                  
                   await  Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", rest: 0, recoveries}})
              
              }
              
                    const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                       // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                        message: `Utilisé en retour complet pour les restes des commandes : ${orderrs.map(item => {
                          const date = new Date(item.date);
                          const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                          return `Recouvrement du reste de ${item.rest} Fcfa de la commande ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                        }).join(', ')}`
                                            });
  
                                    await newOrder.save(); 
  
                                    //console.log("On est dans le 2 x 2 ")
  
                                    res.status(201).json({status: 0});
  
                                    
                           
                                    next();
                
            
            }else if(orders.length > 0 && testCombinaisons2(orders, parseInt(req.body.amount)) && testCombinaisons2(orders, parseInt(req.body.amount)).length > 0){
              
              const orderrs = testCombinaisons2(orders, parseInt(req.body.amount)); 
              
                          for(let orderr of orderrs){
                
                  const recovery = {
        
                                  author_id: user.agg_id, 
                                  amount: orderr.rest && orderr.rest > 0 ? orderr.rest : orderr.amount, 
                                  date: new Date(), 
                                  return: true
  
                                }
                  
                  const recoveries = orderr.recoveries ? orderr.recoveries : []; 
                  recoveries.push(recovery);
                  
                  
                                  
                   await  Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", rest: 0, recoveries}})
              
              }
              
                    const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                       // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                        message: `Utilisé en retour complet pour les commandes : ${orderrs.map(item => {
                          const date = new Date(item.date);
                          const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                          return `Recouvrement ${item.rest && item.rest > 0 ? " du reste de "+ item.rest +"Fcfa de " : "de"} la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                        }).join(', ')}`
                                            });
  
                                    await newOrder.save(); 
  
                                    //console.log("On est dans le 2 x 2 ")
  
                                    res.status(201).json({status: 0});
  
                        
                                    next();
              
              
  
                
              
              
            }else if(initials.length > 0 && countAmountsToTarget(initials, parseInt(req.body.amount)) && countAmountsToTarget(initials, parseInt(req.body.amount)).length > 0){
              
        
              
              const orderrs = countAmountsToTarget(initials, parseInt(req.body.amount)); 
                    console.log("c'est la magie", orderrs);
              
              for(let orderr of orderrs){
                
                                  const recovery = {
        
                                  author_id: user.agg_id, 
                                  amount: orderr.rest && orderr.rest > 0 ? parseInt(orderr.amount) - parseInt(orderr.rest) : orderr.amount, 
                                  date: new Date(), 
                                  return: true
  
                                }
                  
         
                  
                  
                                  
                   await  Order.updateOne({_id: orderr._id}, {$set: {status: orderr.rest && orderr.rest > 0 ? "partial" : "recovery", rest: orderr.rest && orderr.rest > 0 ? orderr.rest : 0, recoveries: [recovery]}})
              }
              
                      const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                       // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                        message: `Utilisé en retour pour les commandes : ${orderrs.map(item => {
                          const date = new Date(item.date);
                          const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                          return `Recouvrement ${item.rest && item.rest > 0 ? " partiel de "+  `${(parseInt(item.amount) - parseInt(item.rest))}` + "Fcfa de " : "de"} la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                        }).join(', ')}`
                                            });
              
              
                      await newOrder.save();  
                      res.status(201).json({status: 0});
  
               
                      next();
              
              
            }else if(partials.length > 0 && countAmountsToTarget2(partials, parseInt(req.body.amount)) && countAmountsToTarget2(partials, parseInt(req.body.amount)).length > 0){
              
        
              const orderrs = countAmountsToTarget2(partials, parseInt(req.body.amount)); 
                    console.log("c'est la seconde magie magie", orderrs);
              
              for(let orderr of orderrs){
                
                                const recovery = {
        
                                  author_id: user.agg_id, 
                                  amount: orderr.rest2 && orderr.rest2 > 0 ? (parseInt(orderr.rest) - parseInt(orderr.rest2)) : orderr.rest, 
                                  date: new Date(), 
                                  return: true
  
                                }
                                  
                            const recoveries =  orderr.recoveries; 
                            recoveries.push(recovery);
                  
         
                  
                  
                                  
                   await  Order.updateOne({_id: orderr._id}, {$set: {status: orderr.rest2 && orderr.rest2 > 0 ? "partial" : "recovery", rest: orderr.rest2 && orderr.rest2 > 0 ?  parseInt(orderr.rest2) : 0, recoveries}})
              }
              
                      const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                       // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                        message: `Utilisé en retour pour les commandes : ${orderrs.map(item => {
                          const date = new Date(item.date);
                          const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                          return `Recouvrement  ${item.rest2 && item.rest2 > 0 ? "partiel de " + `${(parseInt(item.rest) - parseInt(item.rest2))}` +" Fcfa de " : "de "+ item.rest + "Fcfa pour boucler " }  la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                        }).join(', ')}`
                                            });
              
              
                      await newOrder.save();  
                      res.status(201).json({status: 0});
  
          
                      next();
              
              
            }else if(orders.length > 0 && countAmountsToTarget2(orders, parseInt(req.body.amount)) && countAmountsToTarget2(orders, parseInt(req.body.amount)).length > 0){
              
                          const orderrs = countAmountsToTarget2(orders, parseInt(req.body.amount)); 
                          
                          console.log("c'est la troisième magie", orderrs);
              
                          for(let orderr of orderrs){
                            
                              const recovery = {
                                  author_id: user.agg_id, 
                                  amount: (orderr.rest && orderr.rest > 0) ? orderr.rest2 && orderr.rest2 > 0 ?  (parseInt(orderr.rest) - parseInt(orderr.rest2)) : orderr.rest : orderr.rest2 && orderr.rest2 > 0 ? (parseInt(orderr.amount) - parseInt(orderr.rest2)) : orderr.amount , 
                                  date: new Date(), 
                                  return: true
                              }
                              
                            const recoveries = orderr.rest && orderr.rest > 0 ? orderr.recoveries : [] ; 
                            
                            recoveries.push(recovery);
                            
                            await  Order.updateOne({_id: orderr._id}, {$set: {status: orderr.rest2 && orderr.rest2 > 0 ? "partial" : "recovery", rest: (orderr.rest && orderr.rest > 0) ? orderr.rest2 && orderr.rest2 > 0 ? parseInt(orderr.rest) - parseInt(orderr.rest2) : 0 : orderr.rest2 && orderr.rest2 > 0 ? parseInt(orderr.amount) - parseInt(orderr.rest2) : 0 , recoveries}})
                  
                          }
              
                      const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                       // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                        message: `Utilisé en retour pour les commandes : ${orderrs.map(item => {
                          const date = new Date(item.date);
                          const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                          return `Recouvrement ${item.rest2 && item.rest2 > 0 ? " partiel de "+ `${item.rest && item.rest > 0 ? (parseInt(item.rest) - parseInt(item.rest2)) : (parseInt(item.amount) - parseInt(item.rest2)) }` +"Fcfa de " : "de"} la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                        }).join(', ')}`
                                            });
              
              
                      await newOrder.save();  
                      res.status(201).json({status: 0});
  
            
                      next();
              
              
            }else if(orders.length > 0 && findClosestCombination(orders, parseInt(req.body.amount)).array.length > 0){
              
             // console.log("c'est le boss")
              
              const orderrs = findClosestCombination(orders, parseInt(req.body.amount)).array; 
              const theAmount = findClosestCombination(orders, parseInt(req.body.amount)).rest; 
              
                    for(let orderr of orderrs){
                            
                              const recovery = {
                                  author_id: user.agg_id, 
                                  amount: (orderr.rest && orderr.rest > 0) ?  orderr.rest : orderr.amount, 
                                  date: new Date(), 
                                  return: true
                              }
                              
                            const recoveries = orderr.rest && orderr.rest > 0 ? orderr.recoveries : []; 
                            
                            recoveries.push(recovery);
                            
                            await  Order.updateOne({_id: orderr._id}, {$set: {status: "recovery", rest: 0, recoveries}}); 
                      
                  
                          }
              
                      const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                        rest: parseInt(theAmount),
                       // message: `Utilisé en retour partiel pour les commandes  de ${req.body.amount} Fcfa de ${user.name} du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
                        message: `Utilisé en retour complet pour les commandes : ${orderrs.map(item => {
                          const date = new Date(item.date);
                          const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} à ${date.getHours()}h:${date.getMinutes()}mn`;
                          return `Recouvrement ${item.rest && item.rest > 0 ? "de "+ item.rest +  " Fcfa pour boucler " :  "de " } la commande  ${item.type} de ${item.amount} FCFA du  ${formattedDate}`;
                        }).join(', ')}`
                                            });
              
              
                      await newOrder.save();  
                      res.status(201).json({status: 0});
              
               
                      next();
              
              
            }else if(initials.length > 0 && initials.filter(item => parseInt(item.amount) > parseInt(req.body.amount)).length > 0){
              
                console.log("C'est la folie des initials");
              
              const orderr = initials.filter(item => parseInt(item.amount) > parseInt(req.body.amount))[0]; 
              
                                  const recovery = {
        
                                  author_id: user.agg_id, 
                                  amount: req.body.amount, 
                                  date: new Date(), 
                                  return: true
  
                                }
                                  
                   await  Order.updateOne({_id: orderr._id}, {$set: {status: "partial", rest: parseInt(orderr.amount) - parseInt(req.body.amount), recoveries: [recovery]}})
              
                      const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                        message: `Utilisé en retour partiel pour la commande ${orderr.type} de  ${parseInt(orderr.amount)} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
  
                      });
              
              await newOrder.save(); 
              
              //console.log("On est dans le 2")
              
              res.status(201).json({status: 0});
              
             
              next();
              
            
            }else if(partials.length > 0 && partials.filter(item => parseInt(item.rest) > parseInt(req.body.amount)).length > 0){
              
                 console.log("C'est le three partial");
              
                const orderr = partials.filter(item => parseInt(item.rest) > parseInt(req.body.amount))[0]; 
              
                                  const recovery = {
        
                                  author_id: user.agg_id, 
                                  amount: req.body.amount, 
                                  date: new Date(), 
                                  return: true
  
                                }
                                  
                            const recoveries = orderr.recoveries; 
                            recoveries.push(recovery)
                                  
                   await  Order.updateOne({_id: orderr._id}, {$set: {rest: parseInt(orderr.rest) - parseInt(req.body.amount) , recoveries}})
              
                      const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: true, 
                        date: new Date(), 
                        message: `Utilisé en retour partiel pour la commande ${orderr.type} de ${parseInt(orderr.amount)} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()}`
  
                      });
              
              await newOrder.save(); 
              
              //console.log("On est dans le 2")
              
              res.status(201).json({status: 0});
              
         
              next();
                
            
            }else{
              
                   console.log("C'est le sinon partial");
                      const newOrder = new Order({
        
                        amount: parseInt(req.body.amount),
                        phone: req.body.phone,
                        rec_id: user.rec_id, 
                        agg_id: user.agg_id, 
                        type: req.body.type, 
                        status: "return", 
                        agent_id: user._id,
                        read: false, 
                        date: new Date(), 
                      //  message: `Utilisé en retour pour boucler avec ${orderr.rest} Fcfa la commande ${orderr.type} de ${orderr.amount} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()} à ${new Date(orderr.date).getHours()}h:${new Date(orderr.date).getHours()}mn`
  
                      });
              
              await newOrder.save(); 
              
              res.status(201).json({status: 0});
       
              next();
              
              
            }
            
          
          
            
        }       
          

        
      }else{
        
           const newOrder = new Order({
      
                      amount: parseInt(req.body.amount),
                      phone: req.body.phone,
                      type: req.body.type, 
                      status: "return", 
                      read: true, 
                      date: new Date(), 
                    //  message: `Utilisé en retour pour boucler avec ${orderr.rest} Fcfa la commande ${orderr.type} de ${orderr.amount} Fcfa du ${new Date(orderr.date).getDate()}/${new Date(orderr.date).getMonth() + 1}/${new Date(orderr.date).getFullYear()} à ${new Date(orderr.date).getHours()}h:${new Date(orderr.date).getHours()}mn`

                    });
            
            await newOrder.save(); 
        
          res.status(200).json({status: 5}); 
  
          next();
      }
      
      
      
    }catch(e){
      
        console.log(e); 
        res.status(505).json({e})
    }
  

          
  
}
exports.manageReturns2 = async (req, res) => {
  try {
    const { phone, type, amount, balance: newBalance, trans_id } = req.body;
    const userId = req.auth.userId;

    let short, balance;

    switch (type) {
      case "am": short = { amPhone: phone, agg_id: userId }; balance = { amBalance: newBalance }; break;
      case "mm": short = { mmPhone: phone, agg_id: userId }; balance = { mmBalance: newBalance }; break;
      case "flash": short = { flashPhone: phone, agg_id: userId }; balance = { flashBalance: newBalance }; break;
      case "express": short = { expressPhone: phone, agg_id: userId }; balance = { expressBalance: newBalance }; break;
    }

    // Vérifier si déjà enregistré par trans_id
    const existingOrder = await Order.findOne({ trans_id });
    if (existingOrder) {
      return res.status(200).json({ status: 0, message: "Retour déjà enregistré" });
    }

    // Chercher le user
    const user = await User.findOne(short);

    // Si le user est inconnu, enregistrer quand même le retour "fallback"
    if (!user) {
      try {
        await Order.create({
          amount: parseInt(amount),
          phone,
          agg_id: userId,
          type,
          trans_id,
          status: "return",
          read: false,
          date: new Date(),
        });
        return res.status(201).json({ status: 4 });
      } catch (err) {
        if (err.code === 11000) {
          return res.status(200).json({ status: 0, message: "Retour déjà enregistré (fallback)" });
        }
        throw err;
      }
    }

    // Mise à jour du solde
    if (newBalance && amount && amount !== newBalance) {
      await User.updateOne({ _id: userId }, { $set: balance });
    }

    const orders = await Order.find({
      agent_id: user._id,
      status: { $in: ["initial", "partial"] },
      type: { $in: ["am", "mm", "flash", "express"] },
    }).sort({ date: -1 });

    const initials = orders.filter(o => o.status === "initial");
    const partials = orders.filter(o => o.status === "partial");

    const recoveryObj = (amt) => ({
      author_id: user.agg_id,
      amount: amt,
      date: new Date(),
      return: true,
    });

    const formatMessage = (orderList, label) => {
      return `Utilisé en retour pour ${label} : ${orderList.map(item => {
        const d = new Date(item.date);
        return `${item.type} de ${item.amount} FCFA du ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} à ${d.getHours()}h:${d.getMinutes()}mn`;
      }).join(", ")}`;
    };

    const saveReturnOrder = async (usedOrders, message, rest = 0) => {
      try {
        await Order.create({
          amount: parseInt(amount),
          phone,
          rec_id: user.rec_id,
          agg_id: user.agg_id,
          type,
          trans_id,
          status: "return",
          agent_id: user._id,
          read: true,
          date: new Date(),
          rest,
          message,
        });
        return res.status(201).json({ status: 0 });
      } catch (err) {
        if (err.code === 11000) {
          return res.status(200).json({ status: 0, message: "Retour déjà enregistré (conflit)" });
        }
        throw err;
      }
    };

    // Match exact
    const exactMatch = initials.find(o => parseInt(o.amount) === parseInt(amount));
    if (exactMatch) {
      await Order.updateOne({ _id: exactMatch._id }, {
        $set: { status: "recovery", recoveries: [recoveryObj(amount)] },
      });
      return await saveReturnOrder([exactMatch], formatMessage([exactMatch], "la commande"));
    }

    // Combinaisons
    const combo1 = testCombinaisons(initials, parseInt(amount));
    if (combo1?.length) {
      for (const o of combo1) {
        await Order.updateOne({ _id: o._id }, {
          $set: { status: "recovery", recoveries: [recoveryObj(o.amount)] },
        });
      }
      return await saveReturnOrder(combo1, formatMessage(combo1, "les commandes"));
    }

    // Match partiel exact
    const partialMatch = partials.find(o => parseInt(o.rest) === parseInt(amount));
    if (partialMatch) {
      const recoveries = partialMatch.recoveries || [];
      recoveries.push(recoveryObj(partialMatch.rest));
      await Order.updateOne({ _id: partialMatch._id }, {
        $set: { status: "recovery", rest: 0, recoveries },
      });
      return await saveReturnOrder([partialMatch], formatMessage([partialMatch], "le reste de la commande"));
    }

    // Combinaisons sur tous les ordres
    const combo2 = testCombinaisons2(orders, parseInt(amount));
    if (combo2?.length) {
      for (const o of combo2) {
        const recoveries = o.recoveries || [];
        recoveries.push(recoveryObj(o.rest > 0 ? o.rest : o.amount));
        await Order.updateOne({ _id: o._id }, {
          $set: { status: "recovery", rest: 0, recoveries },
        });
      }
      return await saveReturnOrder(combo2, formatMessage(combo2, "les commandes"));
    }

    // Compte exact partiel
    const count1 = countAmountsToTarget(initials, parseInt(amount));
    if (count1?.length) {
      for (const o of count1) {
        const partial = o.rest && o.rest > 0;
        const recoveries = [recoveryObj(partial ? o.amount - o.rest : o.amount)];
        await Order.updateOne({ _id: o._id }, {
          $set: { status: partial ? "partial" : "recovery", rest: partial ? o.rest : 0, recoveries },
        });
      }
      return await saveReturnOrder(count1, formatMessage(count1, "les commandes"));
    }

    const count2 = countAmountsToTarget2(partials, parseInt(amount));
    if (count2?.length) {
      for (const o of count2) {
        const partial = o.rest2 && o.rest2 > 0;
        const recoveries = o.recoveries || [];
        recoveries.push(recoveryObj(partial ? o.rest - o.rest2 : o.rest));
        await Order.updateOne({ _id: o._id }, {
          $set: { status: partial ? "partial" : "recovery", rest: partial ? o.rest2 : 0, recoveries },
        });
      }
      return await saveReturnOrder(count2, formatMessage(count2, "les restes des commandes"));
    }

    const closest = findClosestCombination(orders, parseInt(amount));
    if (closest?.array?.length) {
      for (const o of closest.array) {
        const recoveries = o.recoveries || [];
        recoveries.push(recoveryObj(o.rest > 0 ? o.rest : o.amount));
        await Order.updateOne({ _id: o._id }, {
          $set: { status: "recovery", rest: 0, recoveries },
        });
      }
      return await saveReturnOrder(closest.array, formatMessage(closest.array, "les commandes approximatives"), closest.rest);
    }

    // Si aucun match, fallback
    try {
      await Order.create({
        amount: parseInt(amount),
        phone,
        rec_id: user.rec_id,
        agg_id: user.agg_id,
        type,
        trans_id,
        status: "return",
        agent_id: user._id,
        read: false,
        date: new Date(),
      });
      return res.status(201).json({ status: 0 });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(200).json({ status: 0, message: "Retour déjà enregistré (final fallback)" });
      }
      throw err;
    }

  } catch (e) {
    console.error(e);
    return res.status(505).json({ error: e.message });
  }
};
