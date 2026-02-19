import dotenv from "dotenv";
dotenv.config();

import express from "express";
import {createServer} from "node:http";//Express / normal HTTP requests handle karta hai
import {Server} from "socket.io";//Real-time communication ke liye
import mongoose from "mongoose";
import connectToSocket from "./controllers/socketManager.js";
import cors from "cors";

import userRoutes from "./routes/user_routes.js";

const app=express();
const server=createServer(app);//yaha hum Express app ko HTTP server bana rahe hain
const io=connectToSocket(server);
app.set("port",(process.env.PORT || 8000))

app.use(cors());
app.use(express.json({limit:"40kb"}));//request body ka max size allowed jisse koi banda server crash nh kr skte jada info bhej kr
app.use(express.urlencoded({limit:"40kb",extended:true}));

app.use("/api/v1/users",userRoutes);//userRoutes ke andar jitne bhi routes hain, wo sab /api/v1/users se start honge

const start=async()=>{
    app.set("mongo_user");
    const connectionDb = await mongoose.connect(process.env.MONGO_URL);
    console.log(`MONGO connected DB HOST: ${connectionDb.connection.host}`)
    server.listen(app.get("port"),()=>{
        console.log("LISTENING ON PORT 8000");
    });
}

start();