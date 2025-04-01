import 'react-native-polyfill-globals/auto';

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { db } from "../config/firebase";
import { getDatabase, ref, get } from "firebase/database";

export default function HomeScreen() {
  const router = useRouter();
  useEffect(() => {

    const stopAllStreams = () => {
      if (global.localStream) {
        global.localStream.getTracks().forEach(track => track.stop());
        global.localStream = null;
      }
      if (global.remoteStream) {
        global.remoteStream.getTracks().forEach(track => track.stop());
        global.remoteStream = null;
      }
    };

    stopAllStreams();

    const testFirebase = async () => {
      try {
        const snapshot = await get(ref(db, "calls"));
        if (!snapshot.exists()) console.log("No data available");
      } catch (error) {
        console.error("❌ Error fetching calls:", error);
      }
    };

    testFirebase();
  }, []);
  return (

      <View style={styles.container}>

        <Image source={require('../assets/images/kabootar.png')} style={styles.image} />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 20,
          }}
        />


        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push({ pathname: "/intermediate", params: { mode: "host" } })}
        >
          <Text style={styles.primaryButtonText}>Host a Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push({ pathname: "/intermediate", params: { mode: "join" } })}
        >
          <Text style={[styles.secondaryButtonText, { color: "#345995" }]}>Join a Call</Text>
        </TouchableOpacity>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 20 },
  image: { width: "100%", height: 200, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#345995', marginBottom: 20 },

  // Buttons
  primaryButton: { backgroundColor: '#345995', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10, marginBottom: 10 },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 10,
    borderColor: '#345995',
    borderWidth: 2,
  },


  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  secondaryButtonText: { color: '#345995', fontSize: 18, fontWeight: 'bold' }
});