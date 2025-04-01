  import { mediaDevices, RTCPeerConnection, RTCSessionDescription } from "react-native-webrtc";

  const ICE_SERVERS = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  // export const createPeerConnection = (onICECandidate) => {
  //   const peerConnection = new RTCPeerConnection(ICE_SERVERS);

  //   peerConnection.onicecandidate = (event) => {
  //     if (event.candidate) {
  //       onICECandidate(event.candidate);
  //     }
  //   };

  //   return peerConnection;
  // };
  export const createPeerConnection = (onIceCandidate) => {
    const config = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // ✅ Google STUN server
        { urls: "stun:stun1.l.google.com:19302" }, // Backup STUN server
      ],
    };

    const peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    return peerConnection;
  };

  export const getUserMedia = async () => {
    return await mediaDevices.getUserMedia({
      video: true,
      audio: true,

    });
  };

  export const createOffer = async (peerConnection) => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
    return offer;
  };

  export const createAnswer = async (peerConnection, offer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
    return answer;
  };
