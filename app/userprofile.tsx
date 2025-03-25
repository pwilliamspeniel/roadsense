import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../FirebaseConfig";

interface FormData {
  name: string;
  organization: string;
  profileImage: string | null;
}

const UserProfileForm = () => {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    organization: "",
    profileImage: null,
  });

  const [imageLoading, setImageLoading] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    const loadProfileData = async () => {
      const user = auth.currentUser;

      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const userData = docSnap.data();
          setFormData({
            name: userData.name || "",
            organization: userData.organization || "",
            profileImage: userData.profileImage || null,
          });
        }
      }
    };

    loadProfileData();
  }, [auth]);

  // Function to upload image to ImgBB
  const uploadImageToImgBB = async (uri: string) => {
    try {
      // Create form data
      const formData = new FormData();
      formData.append("image", {
        uri: uri,
        type: "image/jpeg",
        name: "profile.jpg",
      } as any);

      // ImgBB API endpoint
      const response = await fetch(
        "https://api.imgbb.com/1/upload?key=ac603835ee62011f65b1a68f4bab357d",
        {
          method: "POST",
          body: formData,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const responseData = await response.json();

      if (responseData.success) {
        return responseData.data.url;
      } else {
        throw new Error("Image upload failed");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alert("Sorry, we need camera roll permissions to make this work!");
        return;
      }
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      try {
        setImageLoading(true);
        const imageUrl = await uploadImageToImgBB(result.assets[0].uri);
        setFormData((prev) => ({
          ...prev,
          profileImage: imageUrl,
        }));
      } catch (error) {
        alert("Failed to upload image");
      } finally {
        setImageLoading(false);
      }
    }
  };

  // Function to handle form submission
  const handleSubmit = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("No user is logged in. Please authenticate.");
      return;
    }

    if (!formData.name || !formData.organization) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      // Save profile data to Firestore
      await setDoc(doc(db, "users", user.uid), formData);
      alert("Profile saved successfully!");

      // Navigate to the projects screen with user data
      router.push({
        pathname: "/home",
        params: {
          userName: formData.name,
          profileImage: formData.profileImage,
        },
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile.");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Profile</Text>
        <View style={styles.imageContainer}>
          <TouchableOpacity onPress={pickImage} disabled={imageLoading}>
            {formData.profileImage ? (
              <Image
                source={{ uri: formData.profileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Text style={styles.placeholderText}>
                  {imageLoading ? "" : "+"}
                </Text>
              </View>
            )}
            {imageLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#6A3EA1" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.uploadText}>
            {imageLoading
              ? "Uploading..."
              : formData.profileImage
              ? "Change Photo"
              : "Upload Photo"}
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) =>
            setFormData((prev) => ({ ...prev, name: text }))
          }
          placeholder="Enter your name"
          placeholderTextColor="#A0A0A0"
        />

        <Text style={styles.label}>Organization</Text>
        <TextInput
          style={styles.input}
          value={formData.organization}
          onChangeText={(text) =>
            setFormData((prev) => ({ ...prev, organization: text }))
          }
          placeholder="Enter your organization"
          placeholderTextColor="#A0A0A0"
        />

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={imageLoading}
        >
          <Text style={styles.submitButtonText}>
            {imageLoading ? "Please wait..." : "Save Profile"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
    //   backgroundColor: "#FFFFFF", // Black
    },
    header: {
      alignItems: "center",
      padding: 20,
      marginTop: 50,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      marginBottom: 30,
      color: "black", // White for contrast
    },
    imageContainer: {
      alignItems: "center",
      marginBottom: 30,
    },
    profileImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 3,
      borderColor: "black", // White border
    },
    placeholderImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: "white", // Dark grey for contrast
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: "black", // White dashed border
      borderStyle: "dashed",
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.7)",
      borderRadius: 60,
    },
    placeholderText: {
      color: "black", // White text
      fontSize: 40,
      fontWeight: "300",
    },
    uploadText: {
      marginTop: 10,
      color: "#000000", // White text
      fontSize: 16,
    },
    form: {
      padding: 24,
    },
    label: {
      fontSize: 12,
      fontWeight: "600",
      marginBottom: 8,
      color: "black", // White text
    },
    input: {
      backgroundColor: "#ffffff", // Dark grey input background
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: "#FFFFFF", // White border
      fontSize: 16,
      color: "#000000", // White text
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    submitButton: {
      backgroundColor: "#000000", // White button
      padding: 18,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 10,
      shadowColor: "#FFFFFF", // White shadow
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    submitButtonText: {
      color: "white", // Black text for contrast
      fontSize: 16,
      fontWeight: "600",
    },
  });
  
  export default UserProfileForm;
  