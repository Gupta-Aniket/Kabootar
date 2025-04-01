import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert, Animated, Pressable, useWindowDimensions, PanResponder } from "react-native";
// import InCallManager from 'react-native-incall-manager';
import { useKeepAwake } from "expo-keep-awake";
import { RTCView } from "react-native-webrtc";
import { Ionicons } from "@expo/vector-icons";
import { RTCIceCandidate, MediaStream, MediaStreamTrack, RTCPeerConnection, RTCSessionDescription } from "react-native-webrtc";
import { useRouter, useLocalSearchParams } from "expo-router";
const { height, width } = Dimensions.get("window");

// ! the issue is that the mac is putting the simulator in a firewall and stun server cant access it so try (host from mac -> connect from phone) for testing now
import {
  startCall,
  endCall,
  answerCall,
  listenForIceCandidates,
  listenForAnswer,
  listenForCallEnd,
  retryConnection,
  initializePeerConnection,
  listenForOffer
} from "../utils/callService";
import { Gesture, GestureHandlerRootView, TouchableWithoutFeedback } from "react-native-gesture-handler";
import { set } from "firebase/database";

export default function CallScreen() {
  try{
    useKeepAwake(); // Keep the screen awake during the call
  }catch(error){
    console.log("keep awake error");
  }
  const { pin, mode } = useLocalSearchParams(); // Extract mode ('host' or 'join')
  const router = useRouter();

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isTopBottomLayout, setIsTopBottomLayout] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [lastTap, setLastTap] = useState(0);

  const peerConnectionRef = useRef(null);
  const buttonScale = useRef(new Animated.Value(1)).current;


  const pan = useRef(new Animated.ValueXY()).current;
  const controlBarOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimer = useRef(null);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Show controls when dragging starts
        showControls();
        // Stop controls from hiding while dragging
        clearTimeout(hideControlsTimer.current);
        
        // Save the current position as the offset
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        
        // Enwture controlwit tay within screen bounds
        const currentX = pan.x._value;
        const currentY = pan.y._value;
        
        // Get the dimensions of the control bar (estimate)
        const controlBarWidth = width - 40; // based on marginHorizontal: 20
        const controlBarHeight = 70; // estimate
        
        // Calculate bounds to keep controls on screen
        const minX = -(width / 2) + (controlBarWidth / 2);
        const maxX = (width / 2) - (controlBarWidth / 2);
        const minY = -(height / 2) + (controlBarHeight / 2);
        const maxY = (height / 2) - (controlBarHeight / 2) - 30; // Extra space for bottom
        
        // Apply constraints
        let boundedX = Math.min(maxX, Math.max(minX, currentX));
        let boundedY = Math.min(maxY, Math.max(minY, currentY));
        
        // Animate to bounded position
        Animated.spring(pan, {
          toValue: { x: boundedX, y: boundedY },
          useNativeDriver: false
        }).start();
        
        // Start timer to hide controls after dragging
        startHideControlsTimer();
      }
    })
  ).current;


  const localVideoPan = useRef(new Animated.ValueXY()).current;
  const localVideoOpacity = useRef(new Animated.Value(1)).current;
  const localVideoPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        localVideoPan.setOffset({
          x: localVideoPan.x._value,
          y: localVideoPan.y._value
        });
        localVideoPan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: localVideoPan.x, dy: localVideoPan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        localVideoPan.flattenOffset();
      }
    })
  ).current;
  
  // Function to toggle control visibility
  const toggleControls = () => {
    // Check if it's a double tap
    const now = Date.now();
    if (now - lastTap < 300) {
      // Double tap detected, toggle control visibility
      if (controlsVisible) {
        hideControls();
      } else {
        showControls();
      }
      setLastTap(0); // Reset
    } else {
      setLastTap(now);
    }
  };
  
  // Show controls and start hide timer
  const showControls = () => {
    setControlsVisible(true);
    Animated.timing(controlBarOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false
    }).start();
    startHideControlsTimer();
  };

  // Hide controls
  const hideControls = () => {
    Animated.timing(controlBarOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false
    }).start(() => {
      setControlsVisible(false);
    });
  };
  
  // Start timer to auto-hide controls
  const startHideControlsTimer = () => {
    clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      // Only auto-hide if both streams are active
      if (localStream && remoteStream) {
        hideControls();
      }
    }, 5000);
  };

  const initializeCall = async () => {
    // try{
    //   InCallManager.start({media : 'video'});
    //   InCallManager.setSpeakerphoneOn(true);
    // }catch(err){
    //   console.log("[InCallManager] error", err);
    // }
    try {
      const peerConnection = initializePeerConnection();
      peerConnectionRef.current = peerConnection;

      peerConnection.ontrack = (event) => {
        console.log("[Track] Received remote track:", event.track);
        console.log("[Track] Streams available:", event.streams);

        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          console.error("[Track] No remote stream found!");
        }
      };

      if (mode === "host") {
        const { peerConnection: pc, localStream: stream } =
          await startCall(pin, setLocalStream, setRemoteStream, setConnectionStatus);
        setLocalStream(stream);

        // Host listens for answer and ICE candidates
        const offerCandidatesUnsubscribe = listenForIceCandidates(pin, 'offer', pc);
        const answerCandidatesUnsubscribe = listenForIceCandidates(pin, 'answer', pc);
        const answerListener = listenForAnswer(pin, pc, setConnectionStatus);

        return () => {
          offerCandidatesUnsubscribe();
          answerCandidatesUnsubscribe();
          answerListener;
        };
      } else if (mode === "join") {
        // Ensure the call PIN exists before proceeding
        const result = await listenForOffer(pin, setLocalStream, setConnectionStatus);
        if (!result) {
          console.error("Call PIN does not exist. Cannot join the call.");
          Alert.alert("Error", "Call does not exist or has been closed.", [{ text: "OK", onPress: () => router.back() }]);
          return;
        }

        const { peerConnection: pc, localStream: stream } = result;
        if (stream) {
          setLocalStream(stream);
        } else {
          const dummyStream = new MediaStream();
          setLocalStream(dummyStream);
        }


        if (!pc) {
          console.error("Peer connection is null");
          Alert.alert("Error", "Failed to establish a peer connection.");
          return;
        }
        // !! start it later, it is important
        if (!stream) {
          console.error("Stream is null");
          // Alert.alert("Error", "Failed to access media stream.");
          // return;
        }

        // Joiner listens for ICE candidates
        const offerCandidatesUnsubscribe = listenForIceCandidates(pin, 'offer', pc);
        const answerCandidatesUnsubscribe = listenForIceCandidates(pin, 'answer', pc);

        await answerCall(pin, setLocalStream, setRemoteStream, setConnectionStatus);

        return () => {
          offerCandidatesUnsubscribe();
          answerCandidatesUnsubscribe();
        };
      }
    } catch (error) {
      console.error("Call initialization error:", error);
      Alert.alert("Error", "Failed to start the call");
    }
  };

  const handleEndCall = async () => {
    // try{
    //   InCallManager.stop();
    // }catch(err){
    //   console.log("[InCallManager] error", err);
    // }
    try {
      await endCall(pin, mode, peerConnectionRef.current, localStream);

      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
        setLocalStream(null);
      }


      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }


      router.back();
    } catch (error) {
      console.error("End call error:", error);
      Alert.alert("Error", "Failed to end the call");
    }
  };

  const handleToggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => (track.enabled = !track.enabled));
      setIsMicMuted(prev => !prev);
    }
  };

  const handleToggleCamera = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => (track.enabled = !track.enabled));
      setIsCameraOff(prev => !prev);
    }
  };

  const handleToggleLayout = () => {
    setIsTopBottomLayout(prev => !prev);
  };

  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const ControlButton = ({ onPress, icon, activeIcon, isActive, label }) => {
    return (
      <View style={styles.buttonWrapper}>
        <TouchableOpacity
          onPress={() => {
            animateButtonPress();
            onPress();
          }}
          style={[
            styles.controlButton,
            isActive && styles.activeControlButton
          ]}
        >
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <Ionicons
              name={isActive ? activeIcon : icon}
              size={28}
              color="white"
            />
          </Animated.View>
        </TouchableOpacity>
        <Text style={styles.buttonLabel}>{label}</Text>
      </View>
    );
  };

  // Check for stream changes and show controls when needed
  useEffect(() => {
    // Show controls when stream status changes
    showControls();
    
    // If any stream is missing, ensure controls stay visible
    if (!localStream || !remoteStream) {
      clearTimeout(hideControlsTimer.current);
    } else {
      startHideControlsTimer();
    }
  }, [localStream, remoteStream]);

  useEffect(() => {
    let cleanup = null;
  
    const setupCall = async () => {
      cleanup = await initializeCall();
      listenForCallEnd(pin, mode, localStream, peerConnectionRef.current);
    };

    setupCall();

    return () => {
      if (cleanup) cleanup();

      clearTimeout(hideControlsTimer.current);

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        console.log("✅ Local stream stopped");
        setLocalStream(null);
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        console.log("✅ Remote stream stopped");
        setRemoteStream(null);
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [pin, mode]);
//  change on getting the remote stream. -> make sure that the video we get in in proper call layout.

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
        onPress={toggleControls}
      >
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{connectionStatus}</Text>
        </View>

        <TouchableOpacity onPress={() => {
          handleEndCall();
          router.back();
          }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.pinContainer}>
          <Text style={styles.pinText}>PIN: {pin} ({mode.toUpperCase()})</Text>
        </View>

        {isTopBottomLayout ? (
            <View style={styles.topBottomContainer}>
              {remoteStream && (
                <View style={styles.topVideoContainer}>
                  <RTCView mirror={true} streamURL={remoteStream.toURL()} style={styles.topVideo} objectFit="cover" />
                </View>
              )}
              {localStream && (
                <View style={styles.bottomVideoContainer}>
                 
                  <RTCView mirror={true} streamURL={localStream.toURL()} style={styles.bottomVideo} objectFit="cover" />
                </View>
              )}
            </View>
        ) : (
          <View style={styles.videoContainer}>
            {remoteStream && <RTCView mirror={true} streamURL={remoteStream.toURL()} style={[styles.remoteVideo, {height:height}]} objectFit="cover" />}
            {localStream && 
                
            <RTCView mirror={true} streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" />}
          </View>
        )}
      </TouchableOpacity>

      {/* Draggable Control Bar */}
      <Animated.View
        style={[
          styles.controlBarWrapper,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
            opacity: controlBarOpacity
          }
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.dragHandle}>
          <View style={styles.dragIndicator} />
        </View>
        <View style={styles.controlBar}>
          <ControlButton
            onPress={handleToggleMute}
            icon="mic"
            activeIcon="mic-off"
            isActive={isMicMuted}
            label="Mute"
          />

          <ControlButton
            onPress={handleToggleCamera}
            icon="videocam"
            activeIcon="videocam-off"
            isActive={isCameraOff}
            label="Camera"
          />

          <ControlButton
            onPress={handleToggleLayout}
            icon="grid"
            activeIcon="grid"
            isActive={isTopBottomLayout}
            label="Layout"
          />
          

          <TouchableOpacity
            onPress={handleEndCall}
            style={styles.endCallButton}
          >
            <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212"
  },
  statusContainer: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 6,
    zIndex: 10,
    alignItems: "center",
  },
  statusText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500"
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center"
  },
  pinContainer: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    zIndex: 10
  },
  pinText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold"
  },
  videoContainer: {
    flex: 1,
    position: "relative",
    width: "100%",
    height: "100%"
  },
  topBottomContainer: {
    flex: 1,
    flexDirection: "column",
  },
  topVideoContainer: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: "#000",
  },
  bottomVideoContainer: {
    flex: 1,
    borderTopWidth: 2,
    borderTopColor: "#000",
  },
  topVideo: {
    flex: 1,
    backgroundColor: "#2c2c2c",
  },
  bottomVideo: {
    flex: 1,
    backgroundColor: "#2c2c2c",
  },
  remoteVideo: {
    width: "100%",
    height: "100%",
    zIndex: 1,
    backgroundColor: "#2c2c2c"
  },
  localVideo: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: "30%",
    height: "25%",
    zIndex: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "white",
    backgroundColor: "#2c2c2c"
  },
  // New styles for draggable controls
  controlBarWrapper: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 20,
  },
  dragHandle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 5,
  },
  controlBar: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 30,
  },
  buttonWrapper: {
    alignItems: "center",
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(80, 80, 80, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  activeControlButton: {
    backgroundColor: "#4a4a4a",
  },
  buttonLabel: {
    color: "white",
    fontSize: 12,
  },
  endCallButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
});