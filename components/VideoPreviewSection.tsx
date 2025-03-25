import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, SafeAreaView, StyleSheet, View, Alert, Text, StatusBar, Dimensions } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { db, database } from '../FirebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { ref, set } from 'firebase/database';
import * as FileSystem from 'expo-file-system';
import { BlurView } from 'expo-blur';

// Interfaces remain the same
interface SensorDataPoint {
  timestamp: string;
  accelerometer: {
    x: number;
    y: number;
    z: number;
  };
  gyroscope: {
    x: number;
    y: number;
    z: number;
  };
}

interface SpeedDataPoint {
  timestamp: string;
  speed: number;
  location: {
    latitude: number;
    longitude: number;
  }; 
}

interface SavedVideo {
  uri: string;
  status: string;
  userId: string;
  projectId: string;
  createdAt: string;
  sensorData: SensorDataPoint[];
  speedData: SpeedDataPoint[];
}

interface VideoPreviewSectionProps {
  video: { uri: string };
  sensorData: SensorDataPoint[];
  speedData: SpeedDataPoint[];
  handleRetakeVideo: () => void;
  projectId: string;
}

const { width, height } = Dimensions.get('window');

const VideoPreviewSection: React.FC<VideoPreviewSectionProps> = ({
  video,
  sensorData,
  speedData,
  handleRetakeVideo,
  projectId,
}) => {
  // Video state with proper type definitions
  const [status, setStatus] = useState<AVPlaybackStatus | {}>({});
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Directory definitions remain the same
  const VIDEOS_DIRECTORY = `${FileSystem.documentDirectory}saved_videos/`;
  const VIDEOS_INDEX_FILE = `${FileSystem.documentDirectory}videos_index.json`;
  
  // Directory setup function remains the same
  useEffect(() => {
    const setupDirectories = async () => {
      const dirInfo = await FileSystem.getInfoAsync(VIDEOS_DIRECTORY);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(VIDEOS_DIRECTORY, { intermediates: true });
      }
      
      const indexInfo = await FileSystem.getInfoAsync(VIDEOS_INDEX_FILE);
      if (!indexInfo.exists) {
        await FileSystem.writeAsStringAsync(VIDEOS_INDEX_FILE, JSON.stringify([]));
      }
    };
    
    setupDirectories();
  }, []);
  
  // Index reading function remains the same
  const readVideosIndex = async (): Promise<SavedVideo[]> => {
    try {
      const content = await FileSystem.readAsStringAsync(VIDEOS_INDEX_FILE);
      return JSON.parse(content);
    } catch (error) {
      console.error("Error reading videos index:", error);
      return [];
    }
  };
  
  // Index writing function remains the same
  const writeVideosIndex = async (videos: SavedVideo[]) => {
    try {
      await FileSystem.writeAsStringAsync(VIDEOS_INDEX_FILE, JSON.stringify(videos));
    } catch (error) {
      console.error("Error writing videos index:", error);
    }
  };
  
  // Event handlers remain the same but with updated success UI
  const handleSaveVideo = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        const timestamp = Date.now().toString();
        const newFileName = `${VIDEOS_DIRECTORY}video_${timestamp}.mp4`;
        
        await FileSystem.copyAsync({
          from: video.uri,
          to: newFileName
        });
        
        const videoData: SavedVideo = {
          uri: newFileName,
          status: 'pending',
          userId: user.uid,
          projectId: projectId,
          createdAt: new Date().toISOString(),
          sensorData: sensorData.map(point => ({
            timestamp: point.timestamp,
            accelerometer: {
              x: point.accelerometer.x,
              y: point.accelerometer.y,
              z: point.accelerometer.z
            },
            gyroscope: {
              x: point.gyroscope.x,
              y: point.gyroscope.y,
              z: point.gyroscope.z
            }
          })),
          speedData: speedData.map(point => ({
            timestamp: point.timestamp,
            speed: point.speed,
            location: {
              latitude: point.location.latitude,
              longitude: point.location.longitude
            }
          }))
        };
        
        const savedVideos = await readVideosIndex();
        savedVideos.push(videoData);
        await writeVideosIndex(savedVideos);
        
        Alert.alert(
          "Success", 
          "Video saved to app library!", 
          [{ text: "Go to Library", onPress: () => router.push('./appLibrary') }]
        );
      } else {
        Alert.alert("Authentication Required", "You must be logged in to save videos.");
      }
    } catch (error) {
      console.error("Error saving video:", error);
      Alert.alert("Save Failed", "An error occurred while saving the video.");
    }
  };
  
  const handleUploadVideo = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        const timestamp = Date.now().toString();
        
        const videoData = {
          uri: video.uri,
          status: 'uploaded',
          userId: user.uid,
          createdAt: new Date().toISOString(),
        };
        
        const firestoreRef = doc(db, 'videos', timestamp);
        await setDoc(firestoreRef, videoData);
        
        const videoMetadata = {
          uri: video.uri,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          projectId: projectId,
          sensorData: sensorData.map(point => ({
            timestamp: point.timestamp,
            accelerometer: {
              x: point.accelerometer.x,
              y: point.accelerometer.y,
              z: point.accelerometer.z
            },
            gyroscope: {
              x: point.gyroscope.x,
              y: point.gyroscope.y,
              z: point.gyroscope.z
            }
          })),
          speedData: speedData.map(point => ({
            timestamp: point.timestamp,
            speed: point.speed,
            location: {
              latitude: point.location.latitude,
              longitude: point.location.longitude
            }
          }))
        };
        
        const videoRef = ref(database, `videos/${timestamp}`);
        await set(videoRef, videoMetadata);
        
        Alert.alert(
          "Upload Complete", 
          "Video and sensor data uploaded successfully!",
          [{ text: "Go to Home", onPress: () => router.push('./home') }]
        );
      } else {
        Alert.alert("Authentication Required", "You must be logged in to upload videos.");
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      Alert.alert("Upload Failed", "An error occurred while uploading the video.");
    }
  };
  
  const handleDeleteVideo = () => {
    Alert.alert(
      "Delete Video",
      "Are you sure you want to delete this video?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            handleRetakeVideo();
            Alert.alert("Deleted", "Video has been deleted.");
          }
        }
      ]
    );
  };
  
  // Toggle play/pause with proper type annotation
  const togglePlayback = (playbackStatus: AVPlaybackStatus) => {
    setStatus(playbackStatus);
    if (playbackStatus.isLoaded) {
      setIsPlaying(playbackStatus.isPlaying);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Video Preview</Text>
      </View>
      
      <View style={styles.videoWrapper}>
        <Video
          style={styles.previewContainer}
          source={{ uri: video.uri }}
          useNativeControls
          resizeMode={ResizeMode.COVER}
          isLooping
          onPlaybackStatusUpdate={togglePlayback}
        />
        
        {/* Play button overlay removed */}
      </View>
      
      <View style={styles.actionsContainer}>
        <Text style={styles.actionTitle}>Video Actions</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]} 
            onPress={handleDeleteVideo}
          >
            <Ionicons name="trash-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.saveButton]} 
            onPress={handleSaveVideo}
          >
            <Ionicons name="save-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.uploadButton]} 
            onPress={handleUploadVideo}
          >
            <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <BlurView intensity={80} style={styles.dataPreview}>
        <View style={styles.dataSection}>
          <Text style={styles.dataTitle}>
            <Ionicons name="speedometer-outline" size={16} color="#fff" style={styles.dataIcon} />
            Speed Data
          </Text>
          <Text style={styles.dataCount}>{speedData.length} points</Text>
        </View>
        
        <View style={styles.dataSection}>
          <Text style={styles.dataTitle}>
            <Ionicons name="analytics-outline" size={16} color="#fff" style={styles.dataIcon} />
            Sensor Data
          </Text>
          <Text style={styles.dataCount}>{sensorData.length} points</Text>
        </View>
      </BlurView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginRight: 30,
  },
  videoWrapper: {
    width: '92%',
    height: height * 0.5,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    position: 'relative',
    backgroundColor: '#000',
  },
  previewContainer: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -36,
    marginTop: -36,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: {
    padding: 16,
    marginTop: 16,
  },
  actionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 6,
  },
  dataPreview: {
    position: 'absolute',
    bottom: 20,
    left: '5%',
    right: '5%',
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dataSection: {
    flex: 1,
    alignItems: 'center',
  },
  dataTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataIcon: {
    marginRight: 6,
  },
  dataCount: {
    color: '#999',
    fontSize: 14,
  }
});

export default VideoPreviewSection;