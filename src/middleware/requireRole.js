module.exports = function requireRole(...allowedRoles){
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ ok: false, error: "Unauthorized" });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ ok: false, error: "Forbidden" });
        }

        next();
    };
};