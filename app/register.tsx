import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  TouchableWithoutFeedback,
  Image
} from 'react-native';
import { router } from 'expo-router'; 
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../FirebaseConfig';

import { createUserWithEmailAndPassword } from 'firebase/auth';

const SignupScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleSignup = async () => {
    setError(''); // Clear any previous error

    // Simple validation
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!isTermsAccepted) {
      setError('Please accept the terms and privacy policy.');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/userprofile");
    } catch (error) {
    //   setError(error.message); // Set error message from Firebase
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.titleText}>Create account</Text>
        
        {/* {error ? <Text style={styles.errorText}>{error}</Text> : null} */}
        
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        
        <Text style={styles.label}>Create a Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!isPasswordVisible}
          />
          <TouchableOpacity 
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.eyeIcon}
          >
            <Ionicons 
              name={isPasswordVisible ? "eye-off" : "eye"} 
              size={15} 
              color="gray" 
            />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!isPasswordVisible}
          />
          <TouchableOpacity 
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.eyeIcon}
          >
            <Ionicons 
              name={isPasswordVisible ? "eye-off" : "eye"} 
              size={15} 
              color="gray" 
            />
          </TouchableOpacity>
        </View>
        
        <TouchableWithoutFeedback 
          onPress={() => setIsTermsAccepted(!isTermsAccepted)}
        >
          <View style={styles.checkboxContainer}>
            <View style={[
              styles.checkbox, 
              isTermsAccepted && styles.checkboxChecked
            ]}>
              {isTermsAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I accept the terms and privacy policy
            </Text>
          </View>
        </TouchableWithoutFeedback>
        
        <TouchableOpacity 
          style={[
            styles.loginButton, 
            (!isTermsAccepted) && styles.disabledButton
          ]}
          onPress={handleSignup}
          disabled={!isTermsAccepted}
        >
          <Text style={styles.loginButtonText}>Sign Up</Text>
        </TouchableOpacity>
        
        <View style={styles.footerContainer}>
          <Text>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',

  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  eyeIcon: {
    position: 'absolute',
    right: 10,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: 'black',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: 'black',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: 'black',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginLink: {
    color: 'black',
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
},
});

export default SignupScreen;
