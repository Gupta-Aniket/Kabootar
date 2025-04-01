import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useIntermediateController } from "./controller/IntermediateScreenController";
import { useSearchParams } from "expo-router/build/hooks";

export default function IntermediateScreen() {
  const { pin, setPin, modalVisible, setModalVisible, handleContinue, mode } = useIntermediateController();
  const router = useRouter();
  return (
    <Modal animationType="slide" transparent={true} visible={modalVisible}>
      <View style={styles.container}>
        <View style={styles.modalBox}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="black" />
          </TouchableOpacity>
          
          <Text style={styles.title}>
            {mode === "host" ? "Your Meeting PIN" : "Enter Meeting PIN"}
          </Text>

          {mode === "host" ? (
            <Text style={styles.pinDisplay}>{pin}</Text>
          ) : (
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              maxLength={6}
              placeholder="Enter 6-digit PIN"
              value={pin}
              onChangeText={setPin}
            />
          )}

          <TouchableOpacity style={styles.button} onPress={() => handleContinue(mode)}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalBox: {
    backgroundColor: "white",
    width: 300,
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  pinDisplay: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#345995",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#345995",
    padding: 10,
    borderRadius: 5,
    textAlign: "center",
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#345995",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 5,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
