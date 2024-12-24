const User=require("../models/userSchema")

//code for check user blocked or not

const userCheck = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ blocked: false, loggedOut: true });
    }

    const user = await User.findById(req.session.user);
    if (user && user.isBlocked) {
      req.session.destroy(); 
      return res.json({ blocked: true });
    }

    res.json({ blocked: false });
  } catch (error) {
    console.error("Error checking block status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
module.exports={
    userCheck,
}

