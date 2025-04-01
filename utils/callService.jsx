// callService.js - WebRTC and Firebase logic
import { RTCIceCandidate, MediaStream, MediaStreamTrack, RTCPeerConnection, RTCSessionDescription, mediaDevices } from "react-native-webrtc";
import { db as database, ref, set, get, onValue, remove } from "../config/firebase";
import { getUserMedia } from "../utils/webRTC";
import { Alert } from "react-native";
import { router } from "expo-router";
  // If you're using react-native-incall-manager
  import InCallManager from 'react-native-incall-manager';

export const initializePeerConnection = () => {
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });
  
  peerConnection.oniceconnectionstatechange = () => {
    if (peerConnection.iceConnectionState === "failed") {
      Alert.alert(
        "Connection Issue",
        "You may be on a Strict firewall or the internet connection is poor. Try disabling your firewall and restarting the app.",
        [
          { text: "Retry", onPress: () => peerConnection.restartIce() },
          { text: "OK", style: "cancel" }
        ]
      );
    }
  };

  return peerConnection;
};

export const startCall = async (pin, setLocalStream, setRemoteStream, setConnectionStatus) => {
  try {
    console.log("[Caller] Starting call...");


    const localStream = await getUserMedia();

    if (!localStream) {
      console.error("[Caller] Failed to get local stream.");
      return;
    }

    setLocalStream(localStream);
    console.log("[Caller] Local stream obtained.");


    const peerConnection = initializePeerConnection();
    console.log("[Caller] PeerConnection initialized.");


    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
    console.log("[Caller] Local tracks added to PeerConnection.");


    peerConnection.onconnectionstatechange = () => {
      console.log(`[Caller] Connection state changed: ${peerConnection.connectionState}`);
      setConnectionStatus(peerConnection.connectionState);

      if (peerConnection.connectionState === "failed") {
        console.warn("[Caller] Connection failed. Retrying...");
        retryConnection(peerConnection, pin);  
      }
    };


    peerConnection.ontrack = (event) => {
      console.log("[Caller] Remote stream received.", event.streams);
    
      if (event.streams && event.streams.length > 0) {
        setRemoteStream(event.streams[0]);

        console.log("[Caller] Enabling speakerphone via InCallManager");
      } else {
        console.warn("No valid remote stream received.");
      }

    };


    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("[Caller] ICE Candidate generated:", event.candidate);


        await set(ref(database, `calls/${pin}/callerCandidates/${event.candidate.sdpMid}_${event.candidate.sdpMLineIndex}`), event.candidate);


        const answerRef = ref(database, `calls/${pin}/answer`);
        const snapshot = await get(answerRef);

        if (snapshot.exists()) {
          console.log("[Caller] Answer exists. ICE exchange will proceed.");
        } else {
          console.warn("[Caller] No answer yet. ICE candidates stored.");
        }
      }
    };


    console.log("[Caller] Creating offer...");
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await set(ref(database, `calls/${pin}/offer`), offer);
    console.log("[Caller] Offer created and stored in Firebase.");

    return { peerConnection, localStream };
  } catch (error) {
    console.error("[Caller] Error starting call:", error);
    throw error;
  }
};


export const listenForAnswer = (pin, peerConnection, setConnectionStatus) => {
  const answerRef = ref(database, `calls/${pin}/answer`);

  onValue(answerRef, (snapshot) => {
    if (snapshot.exists()) {
      const answer = snapshot.val();

      peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
          console.log("✅ Remote description (answer) set successfully.");
          setConnectionStatus("Connected ✅"); 
        })
        .catch((error) => {
          console.error("❌ Error setting remote description:", error);
          setConnectionStatus("Connection Failed ❌");
        });
    } else {
      console.log("⚠️ No answer found yet...");
      setConnectionStatus("Waiting for Answer ⏳");
    }
  });
};


export const listenForIceCandidates = (pin, type, peerConnection) => {
  const candidatesRef = ref(database, `calls/${pin}/${type}Candidates`);

  const unsubscribe = onValue(candidatesRef, async (snapshot) => {
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const candidate = new RTCIceCandidate(childSnapshot.val());
        peerConnection.addIceCandidate(candidate)
          .then(() => console.log(`✅ ICE Candidate added (${type})`))
          .catch((err) => console.error("❌ Error adding ICE Candidate:", err));
      });
    }
  });

  return unsubscribe; 
};


export const listenForOffer = async (pin) => {
  const offerRef = ref(database, `calls/${pin}/offer`);
  const snapshot = await get(offerRef);

  if (!snapshot.exists()) {
    console.error("No offer found for this PIN.");
    return null; // Prevents undefined errors
  }
  console.log('Initializing peer connection...');
  const peerConnection = initializePeerConnection();
  console.log('Peer connection initialized.');
  console.log('Setting remote Stream');
  const remoteStream = new MediaStream();
  console.log('Remote stream created.');
  console.log('Adding tracks to remote stream');
  peerConnection.ontrack = (event) => {
    remoteStream.addTrack(event.track);
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(snapshot.val()));

  return { peerConnection, remoteStream };
};


export const endCall = async (pin, mode, peerConnection, localStream) => {
  try {

    if (localStream) {
      console.log("Stopping local stream");
      localStream.getTracks().forEach(track => track.stop());
    }


    if (peerConnection && peerConnection.connectionState !== "closed") {
      console.log("Closing peer connection");
      peerConnection.close();
    } else {
      console.warn("⚠️ Peer connection is already closed or invalid.");
    }

    console.log("✅ Call ended by:", mode);



    try{
      await set(ref(database, `calls/${pin}/endedBy`), mode);
    } catch (error) {
      console.error("❌ Error setting 'endedBy' in Firebase:", error);
    }



    setTimeout(async () => {
      try {
        await remove(ref(database, `calls/${pin}`));
        console.log("✅ Call entry removed from Firebase");
      } catch (error) {
        console.error("❌ Error removing call entry:", error);
      }
    }, 2000); // delay for 2 seconds make sure that 'endedb' is synced
  } catch (error) {
    console.error("❌ Error ending call:", error);
  }
};



export const retryConnection = async (peerConnection, pin, setConnectionStatus) => {
  console.log("[Caller] Retrying connection...");


  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await set(ref(database, `calls/${pin}/offer`), offer);

  setConnectionStatus("Reconnecting... ⏳");
};





export const answerCall = async (pin, setLocalStream, setRemoteStream, setConnectionStatus) => {
  try {
    console.log("[Answer] Answering call...");
    const localStream = await getUserMedia();
    if (!localStream) {
      console.error("[Answer] Failed to get local stream.");
      return;
    }
    setLocalStream(localStream);
    console.log("[Answer] Local stream obtained.");

    const peerConnection = initializePeerConnection();
    console.log("[Answer] PeerConnection initialized.");

    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
    console.log("[Answer] Local tracks added to PeerConnection.");

    peerConnection.onconnectionstatechange = () => {
      console.log(`[Answer] Connection state changed: ${peerConnection.connectionState}`);
      setConnectionStatus(peerConnection.connectionState);
    };

    peerConnection.ontrack = (event) => {
      console.log("[Answer] Remote stream received.");
      

      if (event.streams && event.streams.length > 0) {
        setRemoteStream(event.streams[0]);
    
        const audioTrack = event.streams[0].getAudioTracks()[0];
        if (audioTrack) {
          console.log("[Caller] Enabling speakerphone via WebRTC.");
    
          const audioElement = new Audio();
          audioElement.srcObject = event.streams[0];
          audioElement.play()
            .then(() => console.log("[Caller] Audio is playing through speaker."))
            .catch((err) => console.error("[Caller] Failed to play audio:", err));
    

        }
      } else {
        console.warn("No valid remote stream received.");
      }
    };

    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("[Answer] ICE Candidate generated:", event.candidate);
        await set(ref(database, `calls/${pin}/answerCandidates/${event.candidate.sdpMid}_${event.candidate.sdpMLineIndex}`), event.candidate);
      }
    };

    console.log("[Answer] Listening for offer...");
    const offerRef = ref(database, `calls/${pin}/offer`);
    const snapshot = await get(offerRef);

    if (!snapshot.exists()) {
      console.error("[Answer] No offer found for this PIN.");
      return;
    }

    const offer = snapshot.val();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    console.log("[Answer] Remote description (offer) set successfully.");

    console.log("[Answer] Creating answer...");
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await set(ref(database, `calls/${pin}/answer`), answer);
    console.log("[Answer] Answer created and stored in Firebase.");

    return { peerConnection, localStream };
  } catch (error) {
    console.error("[Answer] Error answering call:", error);
    throw error;
  }
};

export const listenForCallEnd = (pin, mode, localStream, peerConnection) => {
  const callRef = ref(database, `calls/${pin}`);
  

  const unsubscribe = onValue(callRef, async (snapshot) => {
    if (snapshot.exists()) {

      const endedByRef = ref(database, `calls/${pin}/endedBy`);
      const endedBySnapshot = await get(endedByRef);
      const endedBy = endedBySnapshot.val();

      console.log(`⚠️ Call ended by: ${endedBy}`);

      
      if (endedBy && endedBy !== mode) {
        Alert.alert(
          "Call Ended",
          `The call was ended by the ${endedBy}.`,
          [{ text: "OK", onPress: () =>  {
            if (localStream) {
              console.log("Stopping local stream");
              localStream.getTracks().forEach(track => track.stop());
            }
        
        
            if (peerConnection && peerConnection.connectionState !== "closed") {
              console.log("Closing peer connection");
              peerConnection.close();
            }
            router.back()
          } }]
        );
      }
    }
  });

  // Return the unsubscribe function
  return unsubscribe;
};

