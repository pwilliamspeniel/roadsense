import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert, StatusBar } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { getAuth } from 'firebase/auth';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { LinearGradient } from 'expo-linear-gradient';
import VideoPreviewSection from '../components/VideoPreviewSection';

// Define interfaces for type safety
interface SensorDataPoint {
  timestamp: string;
  accelerometer: { x: number; y: number; z: number };
  gyroscope: { x: number; y: number; z: number };
}

interface VideoData {
  recordedVideo: { uri: string };
  sensorData: SensorDataPoint[];
  speedData: SpeedDataPoint[];
}

interface SpeedDataPoint {
  timestamp: string;
  speed: number;
  location: { latitude: number; longitude: number };
}

type VideoScreenParams = {
  projectId: string;
};

export default function VideoCamera() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioPermission, requestAudioPermission] = Audio.usePermissions();
  const [recording, setRecording] = useState(false);
  const [video, setVideo] = useState<VideoData | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const locationSubscription = useRef<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTime = useRef<number | null>(null);
  const [currentAccelerometerData, setCurrentAccelerometerData] = useState({ x: 0, y: 0, z: 0 });
  const [currentGyroscopeData, setCurrentGyroscopeData] = useState({ x: 0, y: 0, z: 0 });
  const [sensorHistory, setSensorHistory] = useState<SensorDataPoint[]>([]);
  const [speedHistory, setSpeedHistory] = useState<SpeedDataPoint[]>([]);
  const accelerometerSubscription = useRef<any>(null);
  const gyroscopeSubscription = useRef<any>(null);
  const sensorDataRef = useRef<SensorDataPoint[]>([]);
  const speedDataRef = useRef<SpeedDataPoint[]>([]);
  const isRecordingRef = useRef(false);
  const [isSensorExpanded, setIsSensorExpanded] = useState(false);
  
  // Get projectId from URL params
  const { projectId } = useLocalSearchParams<VideoScreenParams>();

  useEffect(() => {
    const requestPermissions = async () => {
      const locationStatus = await Location.requestForegroundPermissionsAsync();
      if (locationStatus.status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for speed tracking');
      }
    };
    requestPermissions();
    return () => cleanupSubscriptions();
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Not Authenticated', 'You need to be logged in to access the camera.');
      router.push('/home');
    }
  }, []);

  const cleanupSubscriptions = () => {
    if (locationSubscription.current) locationSubscription.current.remove();
    if (timerRef.current) clearInterval(timerRef.current);
    stopSensorTracking();
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    recordingStartTime.current = Date.now();
    setElapsedTime(0);
    timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recordingStartTime.current = null;
    setElapsedTime(0);
  };

  const startSpeedTracking = async () => {
    console.log('🎬 Starting speed and location tracking...');
    speedDataRef.current = [];
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 100, distanceInterval: 0 },
        (newPosition) => {
          const rawSpeed = newPosition.coords.speed ?? 0; // Raw speed in m/s
          const speed = Math.abs(rawSpeed); // Ensure speed is non-negative
          const { latitude, longitude } = newPosition.coords;
          if (isRecordingRef.current) {
            const speedInMph = speed * 2.23694; // Convert to mph
            const speedDataPoint: SpeedDataPoint = {
              timestamp: new Date().toISOString(),
              speed: speedInMph,
              location: { latitude, longitude },
            };
            console.log('🏃‍♂️ Speed and Location Data Point:', {
              timestamp: speedDataPoint.timestamp,
              speed: speedInMph.toFixed(2) + ' mph',
              latitude: latitude.toFixed(5),
              longitude: longitude.toFixed(5),
              rawSpeed: rawSpeed.toFixed(2) + ' m/s', // Log raw speed for debugging
            });
            speedDataRef.current.push(speedDataPoint);
            setCurrentSpeed(speedInMph);
          }
        }
      );
      console.log('✅ Speed and location tracking initialized');
    } catch (error) {
      console.error("❌ Error starting speed tracking:", error);
    }
  };

  const stopSpeedTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setCurrentSpeed(null);
  };

  const startSensorTracking = () => {
    console.log('🎬 Starting sensor tracking...');
    sensorDataRef.current = [];
    const updateInterval = 100;
    accelerometerSubscription.current = Accelerometer.addListener(accelerometerData => {
      if (isRecordingRef.current) {
        setCurrentAccelerometerData(accelerometerData);
        const newDataPoint = {
          timestamp: new Date().toISOString(),
          accelerometer: { ...accelerometerData },
          gyroscope: { ...currentGyroscopeData },
        };
        console.log('📊 Sensor Data Point:', {
          timestamp: newDataPoint.timestamp,
          accelerometer: {
            x: accelerometerData.x.toFixed(3),
            y: accelerometerData.y.toFixed(3),
            z: accelerometerData.z.toFixed(3),
          },
        });
        sensorDataRef.current.push(newDataPoint);
      }
    });
    gyroscopeSubscription.current = Gyroscope.addListener(gyroscopeData => {
      if (isRecordingRef.current) {
        setCurrentGyroscopeData(gyroscopeData);
        const newDataPoint = {
          timestamp: new Date().toISOString(),
          accelerometer: { ...currentAccelerometerData },
          gyroscope: { ...gyroscopeData },
        };
        console.log('🔄 Gyro Data Point:', {
          timestamp: newDataPoint.timestamp,
          gyroscope: {
            x: gyroscopeData.x.toFixed(3),
            y: gyroscopeData.y.toFixed(3),
            z: gyroscopeData.z.toFixed(3),
          },
        });
        sensorDataRef.current.push(newDataPoint);
      }
    });
    Accelerometer.setUpdateInterval(updateInterval);
    Gyroscope.setUpdateInterval(updateInterval);
    console.log('✅ Sensor tracking initialized');
  };

  const stopSensorTracking = () => {
    if (accelerometerSubscription.current) {
      accelerometerSubscription.current.remove();
      accelerometerSubscription.current = null;
    }
    if (gyroscopeSubscription.current) {
      gyroscopeSubscription.current.remove();
      gyroscopeSubscription.current = null;
    }
  };

  const handleStartRecording = async () => {
    if (cameraRef.current && !recording) {
      console.log('🎥 Starting Recording...');
      try {
        isRecordingRef.current = true;
        setRecording(true);
        startTimer();
        await startSpeedTracking();
        startSensorTracking();
        const recordedVideo = await cameraRef.current.recordAsync();
        if (recordedVideo && 'uri' in recordedVideo) {
          const videoData = {
            recordedVideo: { uri: recordedVideo.uri },
            sensorData: [...sensorDataRef.current],
            speedData: [...speedDataRef.current],
          };
          setVideo(videoData);
        }
      } catch (error) {
        console.error("❌ Recording failed:", error);
        Alert.alert("Recording Failed", "Please check your camera settings or permissions.");
        setVideo(null);
      }
    }
  };

  const handleStopRecording = async () => {
    if (cameraRef.current && recording) {
      console.log('🛑 Stopping Recording...');
      try {
        // Save the final data before stopping
        const finalSensorData = [...sensorDataRef.current];
        const finalSpeedData = [...speedDataRef.current];
  
        // Stop recording
        isRecordingRef.current = false;
        await cameraRef.current.stopRecording();
  
        // Clean up
        setRecording(false);
        stopTimer();
        stopSpeedTracking();
        stopSensorTracking();
  
        // Log final statistics after cleanup
        console.log('📊 Final Recording Statistics:', {
          timestamp: new Date().toISOString(),
          totalDuration: `${elapsedTime}s`,
          sensorDataPoints: {
            total: finalSensorData.length,
            firstPoint: finalSensorData.length > 0 
              ? {
                  timestamp: finalSensorData[0].timestamp,
                  accel: `${finalSensorData[0].accelerometer.x.toFixed(2)}, ${finalSensorData[0].accelerometer.y.toFixed(2)}, ${finalSensorData[0].accelerometer.z.toFixed(2)}`,
                  gyro: `${finalSensorData[0].gyroscope.x.toFixed(2)}, ${finalSensorData[0].gyroscope.y.toFixed(2)}, ${finalSensorData[0].gyroscope.z.toFixed(2)}`,
                } 
              : 'N/A',
            lastPoint: finalSensorData.length > 0 
              ? {
                  timestamp: finalSensorData[finalSensorData.length - 1].timestamp,
                  accel: `${finalSensorData[finalSensorData.length - 1].accelerometer.x.toFixed(2)}, ${finalSensorData[finalSensorData.length - 1].accelerometer.y.toFixed(2)}, ${finalSensorData[finalSensorData.length - 1].accelerometer.z.toFixed(2)}`,
                  gyro: `${finalSensorData[finalSensorData.length - 1].gyroscope.x.toFixed(2)}, ${finalSensorData[finalSensorData.length - 1].gyroscope.y.toFixed(2)}, ${finalSensorData[finalSensorData.length - 1].gyroscope.z.toFixed(2)}`,
                } 
              : 'N/A',
          },
          speedDataPoints: {
            total: finalSpeedData.length,
            firstPoint: finalSpeedData.length > 0 
              ? {
                  timestamp: finalSpeedData[0].timestamp,
                  speed: `${finalSpeedData[0].speed.toFixed(2)} mph`,
                  lat: finalSpeedData[0].location.latitude.toFixed(5),
                  lon: finalSpeedData[0].location.longitude.toFixed(5),
                } 
              : 'N/A',
            lastPoint: finalSpeedData.length > 0 
              ? {
                  timestamp: finalSpeedData[finalSpeedData.length - 1].timestamp,
                  speed: `${finalSpeedData[finalSpeedData.length - 1].speed.toFixed(2)} mph`,
                  lat: finalSpeedData[finalSpeedData.length - 1].location.latitude.toFixed(5),
                  lon: finalSpeedData[finalSpeedData.length - 1].location.longitude.toFixed(5),
                } 
              : 'N/A',
          },
        });
  
        console.log('✅ Recording cleanup completed');
      } catch (error) {
        console.error("❌ Error stopping recording:", error);
        Alert.alert("Error", "Failed to stop recording properly");
      }
    }
  };

  const handleRetakeVideo = () => {
    setVideo(null);
    setSensorHistory([]);
    setSpeedHistory([]);
  };

  if (!cameraPermission || !audioPermission) {
    return <View />;
  }

  if (!cameraPermission.granted || !audioPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>We need your permission to show the camera and record audio</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => {
            requestCameraPermission();
            requestAudioPermission();
          }}
        >
          <Text style={styles.permissionButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  if (video && video.recordedVideo) {
    return (
      <VideoPreviewSection 
        video={video.recordedVideo}
        sensorData={video.sensorData}
        speedData={video.speedData}
        handleRetakeVideo={handleRetakeVideo}
        projectId={projectId}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <CameraView mode="video" style={styles.camera} facing={facing} ref={cameraRef} />
      <View style={styles.overlayContainer}>
        {/* Top Timer */}
        {recording && (
          <View style={styles.topTimer}>
            <LinearGradient
              colors={['rgba(255, 59, 48, 0.8)', 'rgba(200, 0, 0, 0.7)']}
              style={styles.timerInner}
            >
              <View style={styles.recordingDot} />
              <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
            </LinearGradient>
          </View>
        )}

        {/* Speed Below Timer */}
        {recording && (
          <View style={styles.speedContainer}>
            <LinearGradient
              colors={['rgba(10, 132, 255, 0.9)', 'rgba(0, 50, 100, 0.7)']}
              style={styles.speedInner}
            >
              <MaterialCommunityIcons name="speedometer" size={24} color="#fff" />
              <Text style={styles.speedText}>
                {currentSpeed !== null ? `${Math.round(currentSpeed)} mph` : '0 mph'}
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Sensors Below Speed */}
        {recording && (
          <TouchableOpacity
            style={styles.sensorContainer}
            onPress={() => setIsSensorExpanded(!isSensorExpanded)}
          >
            <LinearGradient
              colors={['rgba(20, 20, 20, 0.9)', 'rgba(0, 0, 0, 0.8)']}
              style={styles.sensorInner}
            >
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>ACCEL:</Text>
                <Text style={styles.sensorValue}>
                  {currentAccelerometerData.x.toFixed(1)}, {currentAccelerometerData.y.toFixed(1)}, {currentAccelerometerData.z.toFixed(1)}
                </Text>
              </View>
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>GYRO:</Text>
                <Text style={styles.sensorValue}>
                  {currentGyroscopeData.x.toFixed(1)}, {currentGyroscopeData.y.toFixed(1)}, {currentGyroscopeData.z.toFixed(1)}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Expanded Sensor View */}
        {recording && isSensorExpanded && (
          <View style={styles.expandedSensorContainer}>
            <Text style={styles.expandedLabel}>ACCELEROMETER</Text>
            <Text style={styles.expandedValue}>X: {currentAccelerometerData.x.toFixed(2)}</Text>
            <Text style={styles.expandedValue}>Y: {currentAccelerometerData.y.toFixed(2)}</Text>
            <Text style={styles.expandedValue}>Z: {currentAccelerometerData.z.toFixed(2)}</Text>
            <Text style={styles.expandedLabel}>GYROSCOPE</Text>
            <Text style={styles.expandedValue}>X: {currentGyroscopeData.x.toFixed(2)}</Text>
            <Text style={styles.expandedValue}>Y: {currentGyroscopeData.y.toFixed(2)}</Text>
            <Text style={styles.expandedValue}>Z: {currentGyroscopeData.z.toFixed(2)}</Text>
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity style={styles.circleButton}>
            <Ionicons name="images-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={recording ? styles.stopRecordButton : styles.recordButton}
            onPress={recording ? handleStopRecording : handleStartRecording}
          >
            {recording ? <View style={styles.stopIcon} /> : <View style={styles.recordIcon} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleButton} onPress={toggleCameraFacing}>
            <Ionicons name="camera-reverse-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionHeader: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 15,
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#ccc',
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    elevation: 3,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topTimer: {
    alignSelf: 'center',
    marginTop: 40,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  timerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  timerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  speedContainer: {
    alignSelf: 'center',
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  speedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  speedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  sensorContainer: {
    alignSelf: 'center',
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sensorInner: {
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  sensorLabel: {
    color: '#0A84FF',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
    letterSpacing: 0.5,
  },
  sensorValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  expandedSensorContainer: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  expandedLabel: {
    color: '#0A84FF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  expandedValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    marginBottom: 5,
  },
  backButton: {
    position: 'absolute',
    top: 45,
    left: 15,
    padding: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 30,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  circleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  stopRecordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  recordIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF3B30',
  },
  stopIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#FFFFFF',
  },
});