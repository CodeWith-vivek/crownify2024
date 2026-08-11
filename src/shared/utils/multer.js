const multer=require("multer")
const path=require("path")

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

const storage = multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,path.join(__dirname,"../../../public/uploads/re-image"));
    },
    filename:(req,file,cb)=>{
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null,Date.now()+"-"+safeName)
    }
})

const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return cb(new Error("Only image files (jpeg, png, webp, gif) are allowed"));
    }
    cb(null, true);
};

module.exports = {
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
};