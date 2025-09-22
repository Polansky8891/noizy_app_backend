const { Router } = require("express");
const { validateJWT } = require("../middlewares/validate-jwt");

const router = Router();

router.get("/whoami", validateJWT, (req, res) => {
  res.json({
    ok: true,
    userId: String(req.userId || ""),
    auth: req.auth || null,
  });
});

module.exports = router;