const mongoose= require("mongoose")
const {Schema}=mongoose;
const addressSchema =new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },address:[{
        addressType:{
            type:String,
            required:true
        },
        name:{
            type:String,
            required:true

        },
        city:{
            type:String,
            required:true
        }
    }]
})