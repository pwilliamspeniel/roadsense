import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router'; 

const WelcomeScreen = () => {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-between px-6 py-4">
        
        {/* Logo and Company Name */}
        <View className="items-center mt-12 mb-6">
          <View className="bg-[#1F7A5C] rounded-full w-16 h-16 items-center justify-center mb-3">
            <MaterialCommunityIcons name="road-variant" size={36} color="white" />
          </View>
          <Text className="text-gray-800 text-lg font-semibold">RoadSense</Text>
        </View>

        {/* Main Message */}
        <View className="items-center mb-6 px-4">
          <Text className="text-3xl font-bold text-gray-900 text-center mb-4">
            Let's analyze your roads!
          </Text>
          <Text className="text-center text-gray-600 text-base">
            Ready to assess road conditions? RoadSense helps measure roughness and detect obstacles efficiently.
          </Text>
        </View>

        {/* Spacer for balance */}
        <View className="flex-1" />

        {/* Login Options */}
        <View className="w-full space-y-4 mb-8">
          {/* Google button with proper Google styling */}
          <TouchableOpacity className="w-full bg-white py-3 rounded-lg flex-row items-center justify-center border border-gray-300 shadow-sm">
            <View className="mr-2">
              {/* Google "G" icon color scheme */}
              <MaterialCommunityIcons name="google" size={20} color="#1F7A5C" />
            </View>
            <Text className="text-gray-700 font-medium text-base">Continue with Google</Text>
          </TouchableOpacity>

          <View className="flex-row items-center justify-center my-2">
            <View className="h-px bg-gray-200 flex-1" />
            <Text className="text-gray-500 text-sm mx-4">or</Text>
            <View className="h-px bg-gray-200 flex-1" />
          </View>

          <TouchableOpacity 
          className="w-full bg-[#1F7A5C] py-3 rounded-lg items-center"
          onPress={() => {
            router.push("./login");
            console.log('Get Started pressed');
          }}
        >
            <Text className="text-white font-medium">Login to your account</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Up Option */}
        <View className="flex-row items-center justify-center mb-8">
          <Text className="text-gray-500 text-sm">Don't have an account? </Text>
          <TouchableOpacity>
            <Text className="text-[#1F7A5C] font-semibold">Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen;
