import { CONFIG } from "../config.js";
let peerConnection;
let localStream;
let remoteStream;

const servers = {
    iceServers: [
        {
            urls: [
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
            ],
        },
    ],
};
console.log(CONFIG.SIGNALING_SERVER_URL);
const signalingServer = new WebSocket(CONFIG.SIGNALING_SERVER_URL);

// Initialize the local stream and set up the connection
const connect = async () => {
    try {
        // Initialize media streams
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });

        remoteStream = new MediaStream();
        document.getElementById("local-video").srcObject = localStream;

        // Set up RTCPeerConnection
        setupPeerConnection();

        // Create an SDP offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send the offer to the signaling server
        signalingServer.send(JSON.stringify({ type: "offer", offer }));
        console.log("Offer sent to signaling server.");
    } catch (error) {
        console.error("Error initializing connection:", error);
    }
};

// Set up RTCPeerConnection
const setupPeerConnection = () => {
    peerConnection = new RTCPeerConnection(servers);

    // Add local tracks to the connection
    localStream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, localStream));

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
        event.streams[0]
            .getTracks()
            .forEach((track) => remoteStream.addTrack(track));
    };

    document.getElementById("remote-video").srcObject = remoteStream;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            signalingServer.send(
                JSON.stringify({
                    type: "ice-candidate",
                    candidate: event.candidate,
                }),
            );
        }
    };

    console.log("Peer connection set up.");
};

// Handle signaling messages
signalingServer.onmessage = async (message) => {
    const data = JSON.parse(message.data);

    if (data.type === "offer") {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.offer),
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        signalingServer.send(JSON.stringify({ type: "answer", answer }));
        console.log("Answer sent to signaling server.");
    } else if (data.type === "answer") {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.answer),
        );
        console.log("Answer received from signaling server.");
    } else if (data.type === "ice-candidate") {
        await peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate),
        );
        console.log("ICE candidate added.");
    }
};

// End the chat and clean up resources
const endCall = () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
        remoteStream = new MediaStream();
        document.getElementById("remote-video").srcObject = remoteStream;
    }

    console.log("Call ended.");
};

document.getElementById("connect").addEventListener("click", connect);
document.getElementById("endChat").addEventListener("click", endCall);
