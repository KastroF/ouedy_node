const express = require("express"); 
const router = express.Router(); 
const auth = require("../middleware/auth"); 
const smsCtrl = require("../controllers/Sms"); 

router.post("/ingest", auth, smsCtrl.ingest);

module.exports = router; 
