import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";

export const useIntermediateController = () => { 
  const router = useRouter();
  const { mode } = useLocalSearchParams(); // mode : host/ join
  const [pin, setPin] = useState("");
  const [modalVisible, setModalVisible] = useState(true);

  useEffect(() => {
    if (mode === "host") {
      setPin(generatePin());
    }
  }, [mode]);

  const generatePin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleContinue = () => {
    if (mode === "join" && pin.length !== 6) return; 
    setModalVisible(false);
    router.replace(`/call?pin=${pin}&mode=${mode}`);  


  };

  return { pin, setPin, modalVisible, setModalVisible, handleContinue, mode };
};
