// import mongoose, { mongo, Schema } from "mongoose";

// const meetingSchema=new Schema({
//     user_id:{type:String},
//     meetingCode:{type:String,required:true},
//     date:{type: DataTransfer,default:Date.now,required:true}
// })

// const Meeting=mongoose.model("Meeting",meetingSchema);
// export {Meeting};//jb humko ek hei js file se bht saare chizze export krni hogi

import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema({
    user_id: {
        type: String,
        required: true
    },
    meetingCode: {
        type: String,
        required: true
    },
    date: {
        type: Date,          // ✅ yahan Date hoga
        default: Date.now,
        required: true
    }
});

const Meeting = mongoose.model("Meeting", meetingSchema);
export { Meeting };   // multiple exports ke liye sahi hai