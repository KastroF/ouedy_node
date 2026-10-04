// Copie de ouedy/src/infrastructures/ExtractDatas.js (mêmes regex) pour analyser les SMS côté serveur.

function extractBalance(message) {
    // Définir une expression régulière pour capturer le solde
    const regex = /votre solde est de (\d+(?:\.\d+)?) FCFA/;
    const match = message.match(regex);
    
    if (match && match[1]) {
        return parseFloat(match[1]); // Convertir la chaîne en nombre flottant
    } else {
        return null; // Retourner null si le solde n'est pas trouvé
    }
}


function extractMainAccountBalance(message) {
    // Définir une expression régulière pour capturer le solde du compte principal
    const regex = /Compte Principal\s*:\s*([\d,.]+) FCFA/;
    const match = message.match(regex);
    
    if (match && match[1]) {
        // Extraire la partie entière avant la virgule ou le point
        const balance = match[1].split(/[,.]/)[0];
        return parseInt(balance, 10); // Convertir en entier
    } else {
        return null; // Retourner null si le solde n'est pas trouvé
    }
}


function extractEnvoiMmDatas(message) {
    // Définir l'expression régulière pour extraire les informations
     // Extraire le montant envoyé
     const amountMatch = message.match(/envoye\s(\d+)[,.]?/i);
     const amountSent = amountMatch ? parseInt(amountMatch[1]) : null;
 
     // Extraire le numéro de compte et le reformater
     const accountNumberMatch = message.match(/compte Principal\s+(\d{11})/i);
     const accountNumber = accountNumberMatch ? accountNumberMatch[1].replace(/^241/, '0') : null;
 
     // Extraire le solde (partie avant la virgule ou le point)
     const balanceMatch = message.match(/Votre solde\s+est de\s+(\d+)[,.]?/i);
     const balance = balanceMatch ? parseInt(balanceMatch[1]) : null;
 
     return {
         amountSent,
         accountNumber,
         balance
     };
}


function extractAmBalance(message) {
  // Regex pour trouver la phrase contenant le solde
  const regex = /solde de votre compte Airtel Money est de ([\d\s]+)[.,]?\d* FCFA/;
  
  // Exécute la regex sur le message
  const match = message.match(regex);
  
  if (match) {
    // Récupère la partie principale, en supprimant les espaces éventuels
    const mainPart = match[1].replace(/\s+/g, '');
    
    // Convertit la partie principale en nombre entier
    const balance = parseInt(mainPart, 10);
    
    return balance;
  } else {
    // Retourne null si aucun match n'a été trouvé
    return null;
  }
}

  function extractCurrentStock(message) {
    // Regex pour trouver la ligne contenant le stock et capturer le montant
    const regex = /Votre stock actuel est:\s*[A-Z]{2}:[a-zA-Z]+:(\d+)[,.]?/;
  
    // Applique la regex au message
    const match = message.match(regex);
  
    if (match) {
      // Récupère le montant correspondant au stock avant la virgule ou le point
      const stock = parseInt(match[1], 10);
  
      return stock;
    } else {
      // Retourne null si aucun match n'a été trouvé
      return null;
    }
  }

  function EnvoiAmDetails(message) {
    // Expression régulière pour extraire le montant envoyé
    const amountSentMatch = message.match(/envoye\s+(\d+)(?:[.,]\d{0,2})?\s*F/);
    const amountSent = amountSentMatch ? parseInt(amountSentMatch[1], 10) : null;
  
    // Expression régulière pour extraire le numéro de téléphone et le formater
    const phoneNumberMatch = message.match(/au\s+(\d{9})/);
    const phoneNumber = phoneNumberMatch ? phoneNumberMatch[1] : null;
  
    // Expression régulière pour extraire le nouveau solde (partie entière uniquement)
    const newBalanceMatch = message.match(/Nouveau\s+Solde\s+(\d+)(?:[.,]\d{0,2})?\s*F/);
    const newBalance = newBalanceMatch ? parseInt(newBalanceMatch[1], 10) : null;
  
    return {
      amountSent: amountSent,
      phoneNumber: phoneNumber,
      newBalance: newBalance
    };
  }

  function EnvoiExpressDetails(message) {
    // Expression régulière pour extraire le montant envoyé
    const amountSentMatch = message.match(/montant de\s+(\d+(?:\.\d{2})?)\s+FCFA/);
    const amountSent = amountSentMatch ? parseInt(amountSentMatch[1].split('.')[0].replace(/,/g, '')) : null;
  
    // Expression régulière pour extraire le numéro de téléphone du bénéficiaire
    const phoneNumberMatch = message.match(/vers\s+(\d{8})/);
    const phoneNumber = phoneNumberMatch ? '0' + phoneNumberMatch[1] : null;
  
    return {
      amountSent: amountSent,
      phoneNumber: phoneNumber
    };
  }

  function extractNewStock(message, varr) {
    // Expression régulière pour capturer le nouveau stock avant le point ou la virgule
    const stockMatch = varr === 1 ? message.match(/nouveau stock est de\s+(\d+)[,.]?\d*\s+FCFA/i) : message.match(/nouveau stock est\s+(\d+)[,.]?\d*\s+FCFA/i) ;
  
    // Si une correspondance est trouvée, retourner l'entier en convertissant la partie entière
    const newStock = stockMatch ? parseInt(stockMatch[1], 10) : null;
  
    return newStock;
  }

  function extractEtopUpInfo(message) {
    // Regex pour trouver le montant envoyé de eTopUp
    const etopUpMatch = message.match(/Transfert de eTopUP:(\d+)[,.]?\d*\s+cfa/i);
  
    // Regex pour trouver le numéro de réception
    const recipientMatch = message.match(/vers le (\d{8})/);
  
    // Regex pour trouver le nouveau solde
    const newBalanceMatch = message.match(/Nouveau solde:\s*(\d+)[,.]?\d*\s+cfa/i);
  
    // Extraction des valeurs correspondantes
    const etopUpAmount = etopUpMatch ? parseInt(etopUpMatch[1], 10) : null;
    const recipientNumber = recipientMatch ? '0' + recipientMatch[1] : null;
    const newBalance = newBalanceMatch ? parseInt(newBalanceMatch[1], 10) : null;
  
    return {
      etopUpAmount,
      recipientNumber,
      newBalance
    };
  }

  function parseTransactionAmDetails(message) {

    // 🔥 1. Montant reçu (supporte: "Recu" ou "Vous avez recu")
    const amountMatch = message.match(
      /(?:Vous avez\s+)?recu\s+([\d\s]+)\s*(F|FCFA)/i
    );
  
    const amountReceived = amountMatch
      ? parseInt(amountMatch[1].replace(/\s/g, ""), 10)
      : null;
  
  
    // 🔥 2. Numéro envoyeur (du 0745xxxxxx)
    const senderNumberMatch = message.match(/du\s+(\d{9})/i);
    const senderNumber = senderNumberMatch ? senderNumberMatch[1] : null;
  
  
    // 🔥 3. Nom envoyeur (après virgule)
    const senderNameMatch = message.match(/\d{9},\s*([^\.]+?)\./);
    const senderName = senderNameMatch ? senderNameMatch[1].trim() : null;
  
  
    // 🔥 4. Nouveau solde
    const balanceMatch = message.match(
      /Nouveau solde\s+([\d\s]+)\s*(F|FCFA)/i
    );
  
    const newBalance = balanceMatch
      ? parseInt(balanceMatch[1].replace(/\s/g, ""), 10)
      : null;
  
  
    // 🔥 5. Transaction ID / TID (optionnel)
    const tidMatch = message.match(/TID:?\s*([A-Z0-9.]+)/i);
    const transactionId = tidMatch ? tidMatch[1].trim() : null;
  
  
    return {
      amountReceived,
      senderNumber,
      senderName,
      newBalance,
      transactionId,
    };
  }
  

  function extractAgentAmInfo(message) {

    const transIdMatch = message.match(/Trans\.ID\s*:\s*([A-Z0-9.]+)/i);
    const amountMatch = message.match(/recu\s+([0-9\s]+)\s*FCFA/i);
    const phoneMatch = message.match(/de\s+(\d{9})/i);
  
    return {
      transId: transIdMatch ? transIdMatch[1].trim() : null,
      amount: amountMatch ? parseInt(amountMatch[1].replace(/\s/g, '')) : null,
      phone: phoneMatch ? phoneMatch[1] : null,
    };

  }

  function extractSendInfo(message) {
    const amountMatch = message.match(/ENVOI\s+reussi\s+de\s+([0-9\s]+)\s*FCFA/i);
    const phoneMatch = message.match(/au\s+(\d{9})/i);
    const transIdMatch = message.match(/TID:\s*([A-Z0-9.]+)/i);
  
    return {
      amount: amountMatch ? parseInt(amountMatch[1].replace(/\s/g, '')) : null,
      phone: phoneMatch ? phoneMatch[1] : null,
      transId: transIdMatch ? transIdMatch[1] : null
    };
  }
  
  

  function extractStock(message) {
    // Regex pour capturer le solde en FCFA
    const stockMatch = message.match(/GA:eTopUP:(\d+(?:[.,]\d{1,2})?)\s+cfa/i);
    
    if (stockMatch) {
      // Prendre uniquement la partie entière du solde avant le point ou la virgule
      const stockString = stockMatch[1].split(/[.,]/)[0];
      // Convertir la partie entière en un nombre entier
      const stock = parseInt(stockString, 10);
      return stock;
    }
    
    // Retourner null si le format du message ne correspond pas
    return null;
  }

  function parseSms(message) {
    // Regex pour capturer les informations nécessaires
    const montantEnvoyeRegex = /\b(\d+),\d{2} FCFA\b/;
    const numeroRecepteurRegex = /au\s+241(\d{9})\b/;
    const soldeRegex = /solde Moov Money est de (\d+),\d{2} FCFA\b/;

    // Extraction des montants et conversion en nombre entier
    const montantEnvoyeMatch = message.match(montantEnvoyeRegex);
    const montantEnvoye = montantEnvoyeMatch ? parseInt(montantEnvoyeMatch[1], 10) : "Non trouvé";

    // Extraction du numéro de téléphone et transformation
    const numeroRecepteurMatch = message.match(numeroRecepteurRegex);
    const numeroRecepteur = numeroRecepteurMatch ? "0" + numeroRecepteurMatch[1] : "Non trouvé";

    // Extraction du solde et conversion en nombre entier
    const soldeMatch = message.match(soldeRegex);
    const nouveauSolde = soldeMatch ? parseInt(soldeMatch[1], 10) : "Non trouvé";

    return {
        montantEnvoye: montantEnvoye,
        numeroRecepteur: numeroRecepteur,
        nouveauSolde: nouveauSolde
    };
}


function extractElementsReceiveMm2(message) {
  // Regex pour extraire l'ID de la transaction (avant le point)
  const transactionIdMatch = message.match(/^([A-Z0-9]+)\./);
  const transactionId = transactionIdMatch ? transactionIdMatch[1] : null;

  // Regex pour le montant reçu (avant la virgule)
  const receivedAmountMatch = message.match(/Vous avez recu (\d+),\d+ FCFA/);
  const receivedAmount = receivedAmountMatch ? parseInt(receivedAmountMatch[1], 10) : null;

  // Regex pour le numéro qui reçoit (remplacer 241 par 0)
  const receiverNumberMatch = message.match(/du compte (?:Cash Out|Principal)\s+241(\d+)/);
  const receiverNumber = receiverNumberMatch ? `0${receiverNumberMatch[1]}` : null;

  // Regex pour le nouveau solde (avant la virgule)
  const newBalanceMatch = message.match(/Votre solde est de (\d+),\d+ FCFA/);
  const newBalance = newBalanceMatch ? parseInt(newBalanceMatch[1], 10) : null;

  return {
    transactionId,   // ID de la transaction
    receivedAmount,   // Montant reçu
    receiverNumber,   // Numéro du destinataire
    newBalance        // Nouveau solde
  };
}



function extractElementsReceiveMm(message) {
  // Regex pour le montant reçu (avant la virgule)
  const receivedAmountMatch = message.match(/Vous avez recu (\d+),\d+ FCFA/);
  const receivedAmount = receivedAmountMatch ? parseInt(receivedAmountMatch[1], 10) : null;

  // Regex pour le numéro qui reçoit (remplacer 241 par 0)
  const receiverNumberMatch = message.match(/du compte Principal\s+241(\d+)/);
  const receiverNumber = receiverNumberMatch ? `0${receiverNumberMatch[1]}` : null;

  // Regex pour le nouveau solde (avant la virgule)
  const newBalanceMatch = message.match(/Votre solde est de (\d+),\d+ FCFA/);
  const newBalance = newBalanceMatch ? parseInt(newBalanceMatch[1], 10) : null;

  return {
    receivedAmount,
    receiverNumber,
    newBalance
  };
}

function parseETopupMessage(message) {
  const amountMatch = message.match(/eTopUp:(\d+)/i);
  const phoneMatch = message.match(/par le\s+(\d+)/i);
  const balanceMatch = message.match(/Nouveau solde:eTopUp:(\d+)/i);
  const transMatch = message.match(/Transaction ID:\s*([A-Z0-9.\-]+)/i);
  const amount = amountMatch ? parseInt(amountMatch[1]) : null;
  const phone = phoneMatch ? phoneMatch[1] : null;
  const balance = balanceMatch ? "0" + balanceMatch[1] : null;
  const transId = transMatch ? "0" + transMatch[1] : null;

  return { amount, phone, balance, transId };
}
module.exports = {
    extractBalance,
    extractMainAccountBalance,
    extractEnvoiMmDatas,
    extractAmBalance,
    extractCurrentStock,
    EnvoiAmDetails,
    EnvoiExpressDetails,
    extractNewStock,
    extractEtopUpInfo,
    parseTransactionAmDetails,
    extractAgentAmInfo,
    extractSendInfo,
    extractStock,
    parseSms,
    extractElementsReceiveMm2,
    extractElementsReceiveMm,
    parseETopupMessage,
};
