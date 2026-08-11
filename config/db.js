const mongoose=require("mongoose")
const dns=require("dns")
dns.setServers(["8.8.8.8","1.1.1.1"])
const env=require("dotenv").config()
const connectDB=async()=>{
    try{
       await  mongoose.connect(process.env.MONGODB_URI)
       console.log("database connected");
       
    }catch(error){
        console.log("Db connection error",error.message);
        process.exit(1)
        

    }
}

module.exports= connectDB