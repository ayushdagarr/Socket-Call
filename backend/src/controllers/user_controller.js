import httpStatus from "http-status";
import { User } from "../models/user_model.js";
import { Meeting } from "../models/meeting_model.js";
import bcrypt,{hash} from "bcrypt";
import crypto from "crypto";


const login=async(req,res)=>{
    const {username,password}=req.body;
    if(!username||!password){
        return res.status(400).json({message:"Please provide"})
    }
    try{
        const user=await User.findOne({username});
        if(!user){
            return res.status(httpStatus.NOT_FOUND).json({message:"User Not Found"})
        }
        let isPasswordcorrect=await bcrypt.compare(password,user.password);
        if(isPasswordcorrect){
            let token=crypto.randomBytes(20).toString("hex");
            user.token=token;
            await user.save();
            return res.status(httpStatus.OK).json({token:token});
        }else{
            return res.status(httpStatus.UNAUTHORIZED).json({message:"Invalid Username or password"})
        }
    } catch (e){
        return res.status(500).json({message:`Something went wrong ${e}`});
    }
}

const register=async(req,res)=>{
    const {name,username,password}=req.body;
    try{
        const existingUser=await User.findOne({username});
        if(existingUser){
            return res.status(httpStatus.FOUND).json({message:"User already exists"});
        }
        const hashedPassword = await bcrypt.hash(password,10);//password ko lock karne ki layers. 10 layers = medium security

        const newUser=new User({
            name:name,
            username:username,
            password:hashedPassword
        });
        await newUser.save();
        res.status(httpStatus.CREATED).json({message:"User Registed"});

    }catch (e){
        res.json({message:`Something went wrong ${e}`});
    }
}

// const getUserHistory = async (req, res) => {
//     const { token } = req.query;

//     try {
//         const user = await User.findOne({ token: token });
//         const meetings = await meetings.find({ user_id: user.username })
//         res.json(meetings)
//     } catch (e) {
//         res.json({ message: `Something went wrong ${e}` })
//     }
// }

const getUserHistory = async (req, res) => {
    const { token } = req.query;

    try {
        const user = await User.findOne({ token: token });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Yahan fix hai
        const meetings = await Meeting.find({ user_id: user.username });

        res.json(meetings);
    } catch (e) {
        res.status(500).json({ message: `Something went wrong ${e.message}` });
    }
}


const addToHistory = async (req, res) => {
    const { token, meeting_code } = req.body;

    try {
        const user = await User.findOne({ token: token });

        const newMeeting = new Meeting({
            user_id: user.username,
            meetingCode: meeting_code
        })

        await newMeeting.save();

        res.status(httpStatus.CREATED).json({ message: "Added code to history" })
    } catch (e) {
        res.json({ message: `Something went wrong ${e}` })
    }
}


export {login,register,getUserHistory, addToHistory};