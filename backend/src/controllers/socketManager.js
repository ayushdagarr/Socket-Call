import { Server } from "socket.io"

//HTTP server (jo Express se bana hota hai) us HTTP server ke upar Socket.IO attach kar diya io = Socket.IO ka main instance (isi se real-time communication hoti hai)

let connections={}
let messages={}
let timeOnline={}

const  connectToSocket=(server)=>{
    console.log("SOMETHING CONNECTED");
    const io=new Server(server,{
        cors:{
            origin:"*",
            methods:["GET","POST"],
            allowedHeaders:["*"],
            credentials:true
        }
    });
    io.on("connection",(socket)=>{

        socket.on("join-call",(path)=>{
            if(connections[path] === undefined){ 
                connections[path]=[]
            }
            connections[path].push(socket.id);

            timeOnline[socket.id]=new Date();

            for(let a=0;a<connections[path].length;a++){
                io.to(connections[path][a]).emit("user-joined",socket.id,connections[path])
            }

            if(messages[path]!=undefined){
                for(let a=0;a<messages[path].length;++a){
                    //Server ek specific user (current socket) ko purana chat message bhej raha hai
                    io.to(socket.id).emit("chat-message",messages[path][a]['data'],
                        messages[path][a]['sender'], messages[path][a]['socket-id-sender']
                    )
                }
            }

        })

        socket.on("signal",(toId,messages)=>{
            io.to(toId).emit("signal",socket.id,messages);
        })

        socket.on("chat-message",(data,sender)=>{
            const [matchingRoom,found]=Object.entries(connections)
            .reduce(([room,isFound],[roomKey,roomValue])=>{

                if(!isFound && roomValue.includes(socket.id)){
                    return [roomKey,true];
                }
                return [room,isFound];
            },['',false]);

            if(found===true){
                if(messages[matchingRoom]===undefined){
                    messages[matchingRoom]=[]
                }
                //Old messages safe rehte hain, unke saath new message append ho jaata hai
                messages[matchingRoom].push({"sender":sender,"data":data,"socket-id-sender":socket.id})
                console.log("message",matchingRoom,":",sender,data);


                //connections["room1"] = ["id1", "id2", "id3"]
                //User id2 ne message bheja => id1 ko bhejo, id2 ko bhejo (sender ko bhi), id3 ko bhejo|| Server room ke sabhi users ko same message broadcast kar raha hai
                connections[matchingRoom].forEach((elem)=>{
                    io.to(elem).emit("chat-message",data,sender,socket.id);
                })
            }

        })
        //User disconnect hota hai → server uska room find karta hai → room ke sab users ko batata hai → user ko room se nikaal deta hai → room empty ho toh delete

        socket.on("disconnect",()=>{
            var diffTime=Math.abs(timeOnline[socket.id]-new Date());//online time nikala
            var key
            for(const [k,v] of JSON.parse(JSON.stringify(Object.entries(connections)))){

                for(let a=0;a<v.length;++a){
                    if(v[a]===socket.id){//matching room find
                        key=k //kitne socket present hai
                        for(let a=0;a<connections[key].length;++a){
                            io.to(connections[key][a]).emit('user-left',socket.id)
                        }
                        var index=connections[key].indexOf(socket.id)

                        connections[key].splice(index,1)//socket ko hata diya

                        if(connections[key].length===0){
                            delete connections[key]
                        }
                    }
                }
            }

        })
    })

    return io;
}
export default connectToSocket;