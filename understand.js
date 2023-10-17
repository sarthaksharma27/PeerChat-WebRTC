let APP_ID = "YOUR-APP-ID"; // Replace with your Agora App ID

let token = null; // You may set a token for authentication if needed
let uid = String(Math.floor(Math.random() * 10000)); // Generate a random user ID

let client; // Agora RTM client instance
let channel; // Agora RTM channel instance

let queryString = window.location.search; // Get query parameters from the URL
let urlParams = new URLSearchParams(queryString); // Parse query parameters
let roomId = urlParams.get('room'); // Get the 'room' parameter from the URL

if (!roomId) {
    window.location = 'lobby.html'; // Redirect to the lobby if 'room' parameter is missing
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

let constraints = {
    video: {
        width: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 }
    },
    audio: true
};

let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID); // Initialize Agora RTM client with your App ID
    await client.login({ uid, token }); // Log in with the generated user ID and token

    channel = client.createChannel(roomId); // Create a channel with the specified 'roomId'
    await channel.join(); // Join the channel

    channel.on('MemberJoined', handleUserJoined); // Handle user joining events
    channel.on('MemberLeft', handleUserLeft); // Handle user leaving events

    client.on('MessageFromPeer', handleMessageFromPeer); // Handle messages from peers

    localStream = await navigator.mediaDevices.getUserMedia(constraints); // Get the local user's audio and video stream
    document.getElementById('user-1').srcObject = localStream; // Display the local stream in an HTML element
};

let handleUserLeft = (MemberId) => {
    // Hide the remote user's video element and resize the local user's video element
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text); // Parse the incoming message as JSON

    if (message.type === 'offer') {
        // If the message is an offer, create an answer for the remote peer
        createAnswer(MemberId, message.offer);
    }

    if (message.type === 'answer') {
        // If the message is an answer, add the answer
        addAnswer(message.answer);
    }

    if (message.type === 'candidate') {
        if (peerConnection) {
            // If the message is a candidate, add it to the peer connection
            peerConnection.addIceCandidate(message.candidate);
        }
    }
}

let handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel:', MemberId);
    // Create an offer when a new user joins the channel
    createOffer(MemberId);
}

let createPeerConnection = async (MemberId) => {
    // Create an RTCPeerConnection with the specified ICE servers
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();

    // Display the remote user's video stream and adjust the layout
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';
    document.getElementById('user-1').classList.add('smallFrame');

    if (!localStream) {
        // If the local stream is not available, request video access
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        document.getElementById('user-1').srcObject = localStream;
    }

    // Add the local stream's tracks to the peer connection
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            // Add remote user's tracks to the remote stream
            remoteStream.addTrack(track);
        });
    }

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            // Send ICE candidate to the remote peer
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId);
        }
    }
}

let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId); // Create a peer connection for the offer

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send the offer to the remote peer
    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId);
}

let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId); // Create a peer connection for the answer

    await peerConnection.setRemoteDescription(offer); // Set the remote description from the received offer

    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send the answer to the remote peer
    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId);
}

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        // If there's no current remote description, set it as the received answer
        peerConnection.setRemoteDescription(answer);
    }
}

let leaveChannel = async () => {
    await channel.leave(); // Leave the Agora RTM channel
    await client.logout(); // Logout from the Agora RTM client
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video');

    if (videoTrack.enabled) {
        videoTrack.enabled = false; // Disable the video track
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)';
    } else {
        videoTrack.enabled = true; // Enable the video track
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)';
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');

    if (audioTrack.enabled) {
        audioTrack.enabled = false; // Disable the audio track
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)';
    } else {
        audioTrack.enabled = true; // Enable the audio track
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)';
    }
}

window.addEventListener('beforeunload', leaveChannel); // Handle leaving the channel on page unload

document.getElementById('camera-btn').addEventListener('click', toggleCamera); // Add event listener for camera button
document.getElementById('mic-btn').addEventListener('click', toggleMic); // Add event listener for microphone button

init(); // Initialize the application
