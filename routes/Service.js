const express = require("express"); 

const router = express.Router(); 

const serviceCtrl = require("../controllers/Service"); 

const auth = require("../middleware/auth");

router.post('/getstatus', auth, serviceCtrl.getServiceStatus); 
router.post("/testservice", auth, serviceCtrl.testService); 


module.exports = router;