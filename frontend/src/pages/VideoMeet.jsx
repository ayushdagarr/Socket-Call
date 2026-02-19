import React, { useEffect, useRef, useState } from 'react'//useref value ko store krna
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';//Icons → camera, mic, chat, etc.
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'


const server_url = "http://localhost:8000";

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeetComponent() {

    //socket conn,apni socketid,apni video element ka record
    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoref = useRef();

    //Permission mila ya nahi.
    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);

    //User camera/mic on/off state.
    let [video, setVideo] = useState(false);
    let [audio, setAudio] = useState(false);
    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(true);

    let [screenAvailable, setScreenAvailable] = useState();

    //Chat data.
    let [messages, setMessages] = useState([])
    let [message, setMessage] = useState("");

    let [newMessages, setNewMessages] = useState(3);

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState("");

    //Users video list
    //Ye dusre users ke streams store karega.
    const videoRef = useRef([])
    let [videos, setVideos] = useState([])


    //First useEffect
    //Component load hote hi: → Camera + mic permission mangta hai.
    useEffect(() => {
        console.log("HELLO")
        getPermissions();

    },[])

    let getDislayMedia = () => {//Ek function banaya hai jo screen share start karega.
        if (screen) {//Agar screen sharing ON karni hai (screen state true hai) Tabhi aage ka code chalega.
            if (navigator.mediaDevices.getDisplayMedia) {//Kya browser screen capture support karta hai? like chrome,edge etc

                //Browser user se permission mangta hai:Screen and audio ka then user ko popup dikega Share Screen/Window/Tab kya dikhana hai
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })

                    //agr permission miljye toh jo screen stream mili hai usko iss fn mai bhejdo
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    const getPermissions = async () => {
        try {
            //Browser se camera access
            //agr mila=>videoAvailable=true
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);
                console.log('Video permission denied');
            }

            ////Browser se audio access
            //agr mila=>audioAvailable=true
            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    //Stream ko global me store kiya/→ baad me video call / peer connection ke kaam aayega
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        
                        //user ka own camera preview video element me show ho gaya
                        //Apna video screen pe dikhaya
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
                //Camera/Mic on kiya → stream save ki → apna live video screen par dikha diya.
            }
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
            console.log("SET STATE HAS ", video, audio);

        }
    }, [video, audio])


    //Jab user Connect kare: Camera/mic on && Socket server connect
    // let getMedia = () => {
    //     setVideo(videoAvailable);
    //     setAudio(audioAvailable);
    //     connectToSocketServer();//Ye function camera/mic state enable karke socket server se connect karta hai taaki video call start ho sake.
    // }

    let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);

    // wait for media to start first
    setTimeout(() => {
        connectToSocketServer();
    }, 500);
}


    //Camera/Mic stream set karta hai → apne video me dikhata hai → sab users ko bhejta hai → agar stream band ho jaye toh handle karta hai
    let getUserMediaSuccess = (stream) => {
        try {
            //agr phele koi stream chal rhi thi usko band krdo
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        //new stream set, new camera mic stream save kri apne video box mai show krii
        window.localStream = stream
        localVideoref.current.srcObject = stream

        //sb connected users ko stream bhejo loop ke through
        for (let id in connections) {

            //apne aap ko skip krke
            if (id === socketIdRef.current) continue

            //dusre users ko camera mic bhejna start 
            connections[id].addStream(window.localStream)

            //offer bhejo meri stream update hogyi isse connect ho jao
            connections[id].createOffer().then((description) => {
                console.log(description)
                //browser mai apni current stream ki info store kr raha hai
                connections[id].setLocalDescription(description)
                    .then(() => {

                        //setLocalDescription browser me SDP save karta hai — server sirf us SDP ko forward karta hai, dusrse socket ko,store nahi karta.
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        //Agar stream band ho jaye jb user camera off kre,mic off,user disconnect
        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);//phir state ko update krdo
            setAudio(false);

            try {
                //current track ko stop kro
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            //black+silent stream set kro connection break nah ho islye black video and silent audio set kro
            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            //phir wohi same baat sb user ko update bhejo offer bana kr “Ab meri video/audio band ho gayi”
            for (let id in connections) {
                connections[id].addStream(window.localStream)

                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        //Agar user ne camera ON kiya hai aur permission available hai and same as mic
        if ((video && videoAvailable) || (audio && audioAvailable)) {

            //browser user se camera/mic ki live stream leta hai
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })

                //agr stream mili toh getUserMediaSuccess(stream) me jayegi
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                //Agar video bhi OFF aur audio bhi OFF Jo current camera/mic chal raha hai usko off krdo
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }




    //user ne live stream allow krdiya hai
    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try {
            //Purana camera stream band karo Jo pehle camera/mic chal raha tha Uske saare tracks stop kar do Kyuki ab camera → screen switch ho raha hai.
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        //New stream set karo [Global stream = screen stream] Apne video box me bhi screen show ho jayegi
        window.localStream = stream
        localVideoref.current.srcObject = stream

        //Sab users ko new stream bhejo
        for (let id in connections) {//(Sab connected users)

            if (id === socketIdRef.current) continue //khud ko nhi

            connections[id].addStream(window.localStream)//Ab dusre users ko Camera nahi, screen bhejoge


            //offer islye create hota hai kyoki durse user ko pata hei nhi chalta ki screen change hui hai toh usko update[reneogotiation] bolte hai
            connections[id].createOffer().then((description) => {

                //apni current stream ki information save kar raha hai jaise Ab camera nahi, screen video hai,Audio/video tracks ka detail,Codec info,Connection settings
                connections[id].setLocalDescription(description)
                    .then(() => {
                        //setLocalDescription browser me SDP save karta hai — server sirf us SDP ko forward karta hai, dusrse socket ko,store nahi karta.
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
            //sdp=Update info jaati hai → Dusre user ka connection uske according adjust hota hai → Usko wahi naya video (screen/camera) dikhne lagta hai.
        }

        //Jab user screen share band kare Ye event tab chalega jab:User Stop Sharing dabata hai
        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)//Screen state false

            try {
                //Screen tracks stop kara
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }


            //Black screen temporary set Thodi der ke liye black video + silent audio Taaki connection break na ho
            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            //Camera wapas start karo
            getUserMedia()

        })
    }

    //server se aayaa signal(SDP ya ICE) ko handle karna
    //formId=kis user ne bheja
    //message uska data(sdp,ice)
    let gotMessageFromServer = (fromId, message) => {

        //string->object banaya
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {//agr msg khud ka hai ignore sirf dusro ka handle krna

            //agr sdp aaya
            if (signal.sdp) {

                //Remote description set mtlb Dusre user ki media settings save karo (Camera/Screen ka info)
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {

                    //agr type offer hai toh iska mtlb dusra user bol raha hai bhai connect ho jao
                    if (signal.sdp.type === 'offer') {

                        //createAnswer=ok mai ready hoon
                        connections[fromId].createAnswer().then((description) => {

                            //Apne side save karna mtlb Apni media settings browser me save kar li (camera/mic ya screen jo bhi hai)
                            connections[fromId].setLocalDescription(description).then(() => {

                                // A → Offer (meri settings)
                                // B → setRemoteDescription (A ki settings save)
                                // B → createAnswer()
                                // B → setLocalDescription (apni settings save)
                                // B → Answer SDP A ko bhejta hai
                                // B → Answer (meri media settings)
                                // A → setRemoteDescription()
                                // A ko B ka video/screen dikhne lagta hai
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }
            //a ne offer bheja b ne save kra aur answer bheja sdp form same a ne save kara ab a ko b ki screen show hui aur b ko a ki screen show hui

            //ICE dono users ke local/public IP aur ports exchange karke unke beech best possible direct connection establish karta hai.
            //Answer ke baad dono sides ICE exchange karte rehte hain taaki unke beech smooth aur stable direct connection ban jaye.
            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }


    //Socket connect karna + users join hone par WebRTC connections banana
    let connectToSocketServer = () => {

        //server se connection ban gaya
        socketRef.current = io.connect(server_url, { secure: false })

        //jb bhi offer,answer,ICE, ayega toh gotMessageFromServer handle karega
        socketRef.current.on('signal', gotMessageFromServer)

        //Jab socket connect ho jaye
        socketRef.current.on('connect', () => {

            //Room join mtlb iss meeting url waale room mai join ho jao
            socketRef.current.emit('join-call', window.location.href)

            //Apni socket ID save
            socketIdRef.current = socketRef.current.id

            //chat listner
            socketRef.current.on('chat-message', addMessage)

            //User gaya/left → uska video hata do.
            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            //Event trigger id = jo user abhi join hua & clients = room me already jo users hain (sabki socket IDs)
            socketRef.current.on('user-joined', (id, clients) => {

                //Har existing user ke liye connection banao Har user ke saath ek WebRTC connection create karo
                clients.forEach((socketListId) => {
                connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                      
                    //ICE bhejna
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {

                            //Jab bhi ICE mile:Apna network info dusre user ko bhejo
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    //Dusre user ka stream receive,Jab dusre user ka video/audio stream tumhare paas aata hai, tab yeh function chalta hai.
                    //event.stream = dusre bande ka camera + mic stream.
                    connections[socketListId].onaddstream = (event) => {
                        console.log("BEFORE:", videoRef.current);
                        console.log("FINDING ID: ", socketListId);

                        //check karo video already exist karta hai ya nahi
                        //Agar us user ka video pehle se list me hai → update karo||Nahi hai → naya video add karo
                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                        //Agar user pehli baar aaya → new video create
                        //Agar user pehle se hai aur stream change hui → existing video update

                        if (videoExists) {
                            console.log("FOUND EXISTING");

                            //Same user ka video object dhoondo,Uski stream replace karo,React state update karo:=Use case: reconnect ya stream change ho jaye.
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.stream } : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        } else {
                            //Agar video exist nahi karta → naya video add,
                            console.log("CREATING NEW");
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.stream,
                                autoplay: true,
                                playsinline: true
                            };
                            //Naya user join hua
                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];//Uska video list me add kar diya
                                videoRef.current = updatedVideos;
                                return updatedVideos;//UI me new video box dikhega
                            });
                        }
                    };


                    //Agar camera/mic stream already hai,usko dusre user ke connection me add kar do
                    if (window.localStream !== undefined && window.localStream !== null) {
                        connections[socketListId].addStream(window.localStream)
                    } else {

                        //Agar camera/mic ON nahi hai,ek dummy stream (black screen + silence) bhejo Real stream hai toh woh bhejo, nahi hai toh black dummy stream bhejo
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        connections[socketListId].addStream(window.localStream)
                    }
                })
                //New user khud sabko offer bhejega New user khud sabko offer bhejega
                if (id === socketIdRef.current) {
                    //agar haa mai hei hoon

                    //Sab existing users ke liye loop chalao
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue//khud ko skip

                        try {
                            //Apni stream unko bhejo and offer unko bhejo
                            connections[id2].addStream(window.localStream)
                        } catch (e) { }
                        //bhai connect ho jaoo , Offer (SDP) server ke through unko send
                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                        //Dusre users ko tumhari video dikhegi,Aur jab woh answer bhejenge,tumhe unki video dikhegi,Yeh code offer bhejta hai, answer dusra user gotMessageFromServer me bhejta hai.
                    }
                }
            })
        })
    }
    //Yeh functions camera/mic off hone par bhi connection stable rakhne ke liye dummy (black + silent) stream banate hain.

    let silence = () => {//fake audio track banate hai(awaz nhi hoti)
        let ctx = new AudioContext()//AudioContext banaya
        let oscillator = ctx.createOscillator()//Oscillator se audio generate kiya
        let dst = oscillator.connect(ctx.createMediaStreamDestination())//Usko stream me convert kiya
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })//enabled: false → mute
        //Mic off hai, par connection me audio track present hai
    }

    //black video track banate hai
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })//canvas banaya
        canvas.getContext('2d').fillRect(0, 0, width, height)//usko black fill kiya
        let stream = canvas.captureStream()//capture stream() se video banaya
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })//enable:false

        //camera off hai pr video track present hai
    }


    let handleVideo = () => {
        setVideo(!video);
        // getUserMedia();
    }
    let handleAudio = () => {
        setAudio(!audio)
        // getUserMedia();
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen])
    let handleScreen = () => {
        setScreen(!screen);
    }

    // camera/mic/screen band karo aur meeting se bahar nikal jao.
    let handleEndCall = () => {
        try {
            //current stream nikali camera/mic/screen stream
            let tracks = localVideoref.current.srcObject.getTracks()
            //sb track stop kiye:camera off,mic off,screen share off
            tracks.forEach(track => track.stop())
        } catch (e) { }
        //call leave krke home page pr chale gye
        window.location.href = "/home"
    }

    let openChat = () => {
        setModal(true);
        setNewMessages(0);
    }
    let closeChat = () => {
        setModal(false);
    }
    let handleMessage = (e) => {
        setMessage(e.target.value);
    }

    //jb koi chat message aata hai
    const addMessage = (data, sender, socketIdSender) => {

        //Message list mai add kro
        //purane msg + new msg add
        //ui me chat show jo jayega
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);

        //new msg count(notification)
        //agr msg dusre user ne bheja hai
        //unread count+1 krdo notification ki form mai
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };


    //jb tum message send krte ho server ko
    let sendMessage = () => {
        console.log(socketRef.current);

        //socket se server ko msg+username bhej diya
        //server sb users ko broadcast karega
        socketRef.current.emit('chat-message', message, username)

        //msg box clear
        setMessage("");

        // this.setState({ message: "", sender: username })
    }

    
    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }

    //Screen switching system:-
    //1.Lobby dikhani hai 
    //2.ya meeting dikhani hai
    return (
    <div>
        {askForUsername === true ?

            <div style={{ padding: "20px" }}>

                {/* Lobby */}
                <h2 style={{ marginBottom: "15px" }}>
                    Enter into Lobby
                </h2>

                <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                    <TextField
                        id="outlined-basic"
                        label="Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        variant="outlined"
                    />

                    <Button variant="contained" onClick={connect}>
                        Connect
                    </Button>
                </div>

                <div style={{ marginTop: "10px" }}>
                    <video
                        ref={localVideoref}
                        autoPlay
                        muted
                        style={{
                            width: "800px",
                            borderRadius: "10px",
                            backgroundColor: "black"
                        }}
                    ></video>
                </div>

            

                </div> :

                //Meeting screen have 4 parts:-1.chat Box 2.Control Buttons 3.Apna Video 4.Dusre Users ke Videos (Important)
                <div className={styles.meetVideoContainer}>

                    {/**Chat box */}
                    {showModal ? <div className={styles.chatRoom}>{/*Show Model=true->chat show else chat hidden*/}

                        {/*Chat container: chat ka box, upar title chat */}
                        <div className={styles.chatContainer}>
                            <h1>Chat</h1>

                            {/*Messages display area : Yeh area hai jahan messages dikhenge. */}
                            <div className={styles.chattingDisplay}>


                                {/*message hai:message show karo || message nhi:"No message Yet"
                                map() kya karta hai? 
                                message array mai jo elemt. hota hai unko ek-ek karke screen pe show krta hai hai
                                yeha message ek array hai
                                */}
                                {messages.length !== 0 ? messages.map((item, index) => {

                                    console.log(messages)
                                    return (
                                        
                                        <div style={{ marginBottom: "20px" }} key={index}>
                                            {/*jisne bheja */}
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                             {/*original msg */}
                                            <p>{item.data}</p>
                                        </div>
                                    )
                                }) : <p>No Messages Yet</p>}
                                {/*messages array me jo bhi chat data aata hai, map() usko ek-ek karke screen pe show karta hai. Agar array empty hai toh "No Messages Yet" dikhata hai. */}
                            </div>

                            <div className={styles.chattingArea}>
                                <TextField value={message} onChange={(e) => setMessage(e.target.value)} id="outlined-basic" label="Enter Your chat" variant="outlined" />
                                <Button variant='contained' onClick={sendMessage}>Send</Button>
                            </div>


                        </div>
                    </div> : <></>}

                    
                    {/*yeh pura block meeting ke control buttons ka hai. Simple language me:
                    Call ko control karne wale buttons (camera, mic, end, screen, chat) */}
                    <div className={styles.buttonContainers}>

                        {/*
                        state:                icon:
                        video=true            camera on icon
                        video=false           camera off icon
                        Click → handleVideo() camera on/off hota hai
                        */}
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>

                        {/*End Call Button call leave,home page pe redirect */}
                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon  />
                        </IconButton>

                        {/*
                        state:              icon:
                        audio=true          mic on
                        audio=false         mic off

                        Click → mute/unmute
                        */}
                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio === true ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>

                        
                        {/*Screen Share Button:
                        Agar browser screen share support karta hai → button dikhega
                        screen = true → Sharing ON icon
                        screen = false → Stop icon
                        Click → Screen share start/stop
                        */}
                        {screenAvailable === true ?
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton> : <></>}
                        
                        {/*Chat Button + Unread Count:-
                        
                        newMessages = unread messages count
                        Badge pe number dikhega
                        Click → Chat open/close
                        
                        */}
                        {/*newMessages = unread messages ki count
                          Agar 3 unread hai → icon pe 3 dikhega
                          max={999} → 999 se zyada hua toh 999+ dikhega */}
                        <Badge badgeContent={newMessages} max={999} color='orange'>


                            {/*
                            chat icon click
                            Click → showModal toggle
                            Chat open / close
                            */}
                            <IconButton onClick={() => setModal(!showModal)} style={{ color: "white" }}>
                                <ChatIcon />                        </IconButton>
                        </Badge>

                    </div>

                    {/*
                    localVideoref me tumhari stream set hoti hai
                    Camera ya screen share
                    muted → apni awaaz dobara na aaye
                    Yeh tumhara video box hai
                    */}
                    <video className={styles.meetUserVideo} ref={localVideoref} autoPlay muted></video>


                    {/*Container:- Yeh area hai jahan baaki participants ke videos dikhte hain. */}
                    <div className={styles.conferenceView}>

                        {/*Loop chal raha hai:videos ek array hai jisme sab users ke streams stored hote hain. map()=Har user ke liye ek video box bana dega*/}
                        {videos.map((video) => (

                            //Har user ka unique video container.React ko pata rahe kaunsa video kis user ka hai.
                            <div key={video.socketId}>
                                <video
                                    //data-socket: User ki ID store kar raha hai (debug/identify ke liye)
                                    data-socket={video.socketId}

                                    //Video element render ho gaya
                                    //Agar stream available hai
                                    //Us stream ko video element me attach kar do
                                    //Dusre user ka camera live dikhne lagega
                                    ref={ref => {
                                        if (ref && video.stream) {
                                            ref.srcObject = video.stream;
                                        }
                                    }}
                                    //Video automatically start ho jayega
                                    autoPlay
                                >
                                </video>
                            </div>

                        ))}

                    </div>

                </div>

            }

        </div>
    )
}
