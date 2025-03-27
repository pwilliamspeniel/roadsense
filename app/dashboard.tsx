import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { get, getDatabase, ref } from "firebase/database";
import { LineChart } from "react-native-chart-kit";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

interface LocationState {
  latitude: number;
  longitude: number;
}

interface VideoData {
  createdAt: string;
  projectId: string;
  sensorData: Array<{
    accelerometer: { x: number; y: number; z: number };
    gyroscope: { x: number; y: number; z: number };
    timestamp: string;
  }>;
  speedData: Array<{
    location: { latitude: number; longitude: number };
    speed: number; // In mph
    timestamp: string;
  }>;
}

interface SensorChartProps {
  sensorData: VideoData["sensorData"];
  sensorType: "gyroscope" | "accelerometer";
  title: string;
}

type SegmentData = {
  accelerationY: number;
  accelerationZ: number;
  speedv: number; // In mph
  unixTimestamp: number;
  latitude: number;
  longitude: number;
};

type PredictionResult = {
  segment: SegmentData;
  prediction: number; // IRI in m/km
  distanceStart: number;
  distanceEnd: number;
};

const SensorChart: React.FC<SensorChartProps> = ({ sensorData, sensorType, title }) => {
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = Math.max(screenWidth * 1.5, sensorData.length * 50);

  const timestamps = sensorData.map((data) =>
    new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  const xData = sensorData.map((data) => data[sensorType].x);
  const yData = sensorData.map((data) => data[sensorType].y);
  const zData = sensorData.map((data) => data[sensorType].z);

  const chartData = {
    labels: timestamps,
    datasets: [
      { data: xData, color: () => "#FF6B6B", strokeWidth: 1.5, withDots: false },
      { data: yData, color: () => "#4ECDC4", strokeWidth: 1.5, withDots: false },
      { data: zData, color: () => "#FFD93D", strokeWidth: 1.5, withDots: false },
    ],
    legend: ["X-axis", "Y-axis", "Z-axis"],
  };

  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "0", strokeWidth: "0" },
    propsForLabels: { fontSize: 8, rotation: 45 },
  };

  return (
    <View style={styles.chartContainerSmall}>
      <Text style={styles.chartTitleSmall}>{title}</Text>
      <Text style={styles.chartSubtitleSmall}>Scroll horizontally for more</Text>
      <ScrollView horizontal={true} style={styles.chartScrollView}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={120}
          chartConfig={chartConfig}
          style={styles.chartSmall}
          withInnerLines={true}
          withOuterLines={true}
          withHorizontalLabels={true}
          withVerticalLabels={true}
          withDots={false}
          withShadow={false}
          yAxisInterval={1}
          bezier
        />
      </ScrollView>
      <View style={styles.legendContainerSmall}>
        {chartData.legend.map((label, index) => (
          <View key={index} style={styles.legendItemSmall}>
            <View style={[styles.legendColorSmall, { backgroundColor: chartData.datasets[index].color() }]} />
            <Text style={styles.legendTextSmall}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const BridgeDashboard: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationState | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [chartPage, setChartPage] = useState(0);
  const [chartsPerPage] = useState(10);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);

  const MILES_TO_METERS = 1609.34;
  const SEGMENT_LENGTH_MILES = 0.1;
  const SEGMENT_LENGTH_METERS = SEGMENT_LENGTH_MILES * MILES_TO_METERS;

  useEffect(() => {
    let isMounted = true;

    const fetchVideoData = async () => {
      try {
        const db = getDatabase();
        const videosRef = ref(db, "videos");
        const snapshot = await get(videosRef);

        if (!snapshot.exists()) {
          setFetchError("No video data available");
          return;
        }

        const videos = snapshot.val();
        const matchingVideo = Object.values(videos).find((video: any) => video.projectId) as VideoData | undefined;

        if (matchingVideo) {
          setVideoInfo(matchingVideo);
        } else {
          setFetchError("No matching project found");
        }
      } catch (err) {
        console.error("Error fetching video data:", err);
        setFetchError("Failed to fetch video data");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Location permission is required.");
          return;
        }
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (isMounted) {
          setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
        }
      } catch (err) {
        setError("Failed to get location");
        Alert.alert("Error", "Failed to get your current location");
      }
    };

    fetchVideoData();
    getLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const processDataIntoSegments = (videoData: VideoData): SegmentData[] => {
    let segments: SegmentData[] = [];
    if (!videoData.speedData || !videoData.sensorData || videoData.speedData.length === 0 || videoData.sensorData.length === 0) {
      return segments;
    }

    let currentDistance = 0;
    let segmentStartIndex = 0;
    const sortedSpeedData = [...videoData.speedData].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 1; i < sortedSpeedData.length; i++) {
      const prevPoint = sortedSpeedData[i - 1];
      const currentPoint = sortedSpeedData[i];
      const distance = calculateDistance(
        prevPoint.location.latitude,
        prevPoint.location.longitude,
        currentPoint.location.latitude,
        currentPoint.location.longitude
      );

      currentDistance += distance;
      if (currentDistance >= SEGMENT_LENGTH_METERS || i === sortedSpeedData.length - 1) {
        const segmentPoints = sortedSpeedData.slice(segmentStartIndex, i + 1);
        const segmentTimestamp = new Date(segmentPoints[0].timestamp).getTime();
        const segmentAccData = videoData.sensorData.filter((sensorPoint) => {
          const sensorTime = new Date(sensorPoint.timestamp).getTime();
          return (
            sensorTime >= segmentTimestamp &&
            sensorTime <= new Date(segmentPoints[segmentPoints.length - 1].timestamp).getTime()
          );
        });

        if (segmentAccData.length > 0 && segmentPoints.length > 0) {
          const avgAccY = segmentAccData.reduce((sum, point) => sum + point.accelerometer.y, 0) / segmentAccData.length;
          const avgAccZ = segmentAccData.reduce((sum, point) => sum + point.accelerometer.z, 0) / segmentAccData.length;
          const avgSpeed = segmentPoints.reduce((sum, point) => sum + point.speed, 0) / segmentPoints.length; // Already in mph
          segments.push({
            accelerationY: avgAccY,
            accelerationZ: avgAccZ,
            speedv: avgSpeed,
            unixTimestamp: Math.floor(segmentTimestamp / 1000),
            latitude: segmentPoints[0].location.latitude,
            longitude: segmentPoints[0].location.longitude,
          });
        }
        currentDistance = 0;
        segmentStartIndex = i;
      }
    }
    return segments;
  };

  const processPrediction = async (data: SegmentData): Promise<number> => {
    try {
      const response = await fetch("https://roadsense.onrender.com/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accelerationY: [data.accelerationY],
          accelerationZ: [data.accelerationZ],
          speedv: [data.speedv], // In mph
          unixTimestamp: [data.unixTimestamp],
          latitude: [data.latitude],
          longitude: [data.longitude],
        }),
      });

      if (!response.ok) throw new Error("Network response was not ok");
      const result = await response.json();
      return Number(result.predictions?.[0] ?? 0);
    } catch (error) {
      console.error("Error in processPrediction:", error);
      return 0;
    }
  };

  const handlePredictions = async () => {
    if (!videoInfo) {
      Alert.alert("Error", "No video data available");
      return;
    }

    setIsPredicting(true);
    try {
      const segments = processDataIntoSegments(videoInfo);
      if (segments.length === 0) throw new Error("No valid segments found in the data");

      const results: PredictionResult[] = [];
      let totalDistance = 0;

      for (const segment of segments) {
        const prediction = await processPrediction(segment);
        results.push({
          segment,
          prediction: Number(prediction),
          distanceStart: totalDistance,
          distanceEnd: totalDistance + SEGMENT_LENGTH_MILES,
        });
        totalDistance += SEGMENT_LENGTH_MILES;
      }
      setPredictions(results);
    } catch (err: any) {
      Alert.alert("Error", `Failed to process predictions: ${err.message}`);
    } finally {
      setIsPredicting(false);
    }
  };

  const toggleMapSize = () => setIsMapFullScreen(!isMapFullScreen);

  const locations = videoInfo?.speedData
    ? videoInfo.speedData
        .map((data) => ({
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        }))
        .filter((loc) => loc.latitude && loc.longitude && !isNaN(loc.latitude) && !isNaN(loc.longitude))
    : [];

  const totalPages = Math.ceil((videoInfo?.sensorData?.length || 0) / chartsPerPage);
  const currentSensorData = videoInfo?.sensorData?.slice(chartPage * chartsPerPage, (chartPage + 1) * chartsPerPage) || [];

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#000000" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Project Dashboard</Text>
      </View>

      <View style={styles.contentWrapper}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isMapFullScreen}
        >
          <View style={[styles.mapContainer, isMapFullScreen && styles.mapContainerFullScreen]}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: currentLocation?.latitude || locations[0]?.latitude || 0,
                longitude: currentLocation?.longitude || locations[0]?.longitude || 0,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              showsUserLocation={true}
            >
              {locations.map((location, index) => (
                <Marker
                  key={index}
                  coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                  title={`Data Point ${index + 1}`}
                />
              ))}
              <Polyline coordinates={locations} strokeColor="#000000" strokeWidth={4} />
            </MapView>
            {!isMapFullScreen && (
              <TouchableOpacity 
                style={styles.zoomButtonInsideMap}
                onPress={toggleMapSize}
              >
                <MaterialCommunityIcons name="arrow-expand" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {!isMapFullScreen && (
            <>
              <TouchableOpacity style={styles.predictButton} onPress={handlePredictions} disabled={isPredicting}>
                <MaterialCommunityIcons name="chart-bell-curve" size={20} color="#FFFFFF" />
                <Text style={styles.predictText}>{isPredicting ? "Processing..." : "Generate IRI Predictions"}</Text>
              </TouchableOpacity>
              {predictions.length > 0 && (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>IRI Predictions</Text>
                  <Text style={styles.chartSubtitle}>Roughness Index (m/km) over Distance (miles)</Text>
                  <LineChart
                    data={{
                      labels: predictions.map((p) => p.distanceStart.toFixed(1)),
                      datasets: [
                        { data: predictions.map((p) => p.prediction), color: () => "#6200EE", strokeWidth: 2 },
                      ],
                    }}
                    width={width - 32}
                    height={220}
                    chartConfig={{
                      backgroundColor: "#ffffff",
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#ffffff",
                      decimalPlaces: 1,
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      style: { borderRadius: 16 },
                      propsForDots: { r: "4", strokeWidth: "2", stroke: "#6200EE" },
                    }}
                    bezier
                    style={styles.chart}
                    yAxisSuffix=" m/km"
                    xAxisLabel="Mile "
                    fromZero
                  />
                </View>
              )}

              {currentSensorData.length > 0 && (
                <>
                  <SensorChart sensorData={currentSensorData} sensorType="accelerometer" title="Accelerometer Data" />
                  <SensorChart sensorData={currentSensorData} sensorType="gyroscope" title="Gyroscope Data" />
                </>
              )}

              {totalPages > 1 && (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    onPress={() => setChartPage(Math.max(chartPage - 1, 0))}
                    disabled={chartPage === 0}
                    style={[styles.paginationButton, chartPage === 0 && styles.disabledButton]}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.pageText}>Page {chartPage + 1} of {totalPages}</Text>
                  <TouchableOpacity
                    onPress={() => setChartPage(Math.min(chartPage + 1, totalPages - 1))}
                    disabled={chartPage === totalPages - 1}
                    style={[styles.paginationButton, chartPage === totalPages - 1 && styles.disabledButton]}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {isMapFullScreen && (
          <TouchableOpacity 
            style={styles.zoomButtonOverlay}
            onPress={toggleMapSize}
          >
            <MaterialCommunityIcons name="arrow-collapse" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    zIndex: 2000,
  },
  backButton: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: { 
    flexGrow: 1, 
    padding: 16,
  },
  mapContainer: {
    height: 400,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'white',
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  mapContainerFullScreen: {
    height: height - 80,
    marginBottom: 0,
    borderRadius: 0,
  },
  map: { 
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  zoomButtonInsideMap: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 25,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  zoomButtonOverlay: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 25,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  chartContainerSmall: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  chartScrollView: { width: '100%' },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  chartTitleSmall: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  chartSubtitle: { fontSize: 12, color: '#666', marginBottom: 8 },
  chartSubtitleSmall: { fontSize: 10, color: '#666', marginBottom: 4 },
  chart: { borderRadius: 8 },
  chartSmall: { borderRadius: 8 },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  legendContainerSmall: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  legendItemSmall: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  legendColor: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  legendColorSmall: { width: 8, height: 8, borderRadius: 4, marginRight: 3 },
  legendText: { fontSize: 12, color: '#666' },
  legendTextSmall: { fontSize: 10, color: '#666' },
  predictButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  predictText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  paginationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  paginationButton: {
    backgroundColor: '#000000',
    padding: 6,
    borderRadius: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  disabledButton: { backgroundColor: '#CCCCCC' },
  pageText: { fontSize: 14, color: '#333' },
  errorText: { color: 'red', textAlign: 'center', fontSize: 16 },
  retryButton: {
    backgroundColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default BridgeDashboard;


// import React, { useState, useEffect } from "react";
// import {
//   View,
//   Text,
//   SafeAreaView,
//   ActivityIndicator,
//   TouchableOpacity,
//   Alert,
//   StyleSheet,
//   Dimensions,
//   ScrollView,
//   Platform,
// } from "react-native";
// import { useNavigation } from "@react-navigation/native";
// import MapView, { Marker, Polyline } from "react-native-maps";
// import * as Location from "expo-location";
// import { get, getDatabase, ref } from "firebase/database";
// import { LineChart } from "react-native-chart-kit";
// import { MaterialCommunityIcons } from "@expo/vector-icons";

// const { width, height } = Dimensions.get("window");

// interface LocationState {
//   latitude: number;
//   longitude: number;
// }

// interface VideoData {
//   createdAt: string;
//   projectId: string;
//   sensorData: Array<{
//     accelerometer: { x: number; y: number; z: number };
//     gyroscope: { x: number; y: number; z: number };
//     timestamp: string;
//   }>;
//   speedData: Array<{
//     location: { latitude: number; longitude: number };
//     speed: number;
//     timestamp: string;
//   }>;
// }

// interface SensorChartProps {
//   sensorData: VideoData["sensorData"];
//   sensorType: "gyroscope" | "accelerometer";
//   title: string;
// }

// type SegmentData = {
//   accelerationZ: number;
//   speedv: number;
//   unixTimestamp: number;
//   latitude: number;
//   longitude: number;
// };

// type PredictionResult = {
//   segment: SegmentData;
//   prediction: number;
//   distanceStart: number;
//   distanceEnd: number;
// };

// const SensorChart: React.FC<SensorChartProps> = ({ sensorData, sensorType, title }) => {
//   const screenWidth = Dimensions.get("window").width;
//   const chartWidth = Math.max(screenWidth * 1.5, sensorData.length * 50);

//   const timestamps = sensorData.map((data) =>
//     new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
//   );

//   const xData = sensorData.map((data) => data[sensorType].x);
//   const yData = sensorData.map((data) => data[sensorType].y);
//   const zData = sensorData.map((data) => data[sensorType].z);

//   const chartData = {
//     labels: timestamps,
//     datasets: [
//       { data: xData, color: () => "#FF6B6B", strokeWidth: 1.5, withDots: false },
//       { data: yData, color: () => "#4ECDC4", strokeWidth: 1.5, withDots: false },
//       { data: zData, color: () => "#FFD93D", strokeWidth: 1.5, withDots: false },
//     ],
//     legend: ["X-axis", "Y-axis", "Z-axis"],
//   };

//   const chartConfig = {
//     backgroundColor: "#ffffff",
//     backgroundGradientFrom: "#ffffff",
//     backgroundGradientTo: "#ffffff",
//     decimalPlaces: 2,
//     color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
//     labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
//     style: { borderRadius: 16 },
//     propsForDots: { r: "0", strokeWidth: "0" },
//     propsForLabels: { fontSize: 8, rotation: 45 },
//   };

//   return (
//     <View style={styles.chartContainerSmall}>
//       <Text style={styles.chartTitleSmall}>{title}</Text>
//       <Text style={styles.chartSubtitleSmall}>Scroll horizontally for more</Text>
//       <ScrollView horizontal={true} style={styles.chartScrollView}>
//         <LineChart
//           data={chartData}
//           width={chartWidth}
//           height={120}
//           chartConfig={chartConfig}
//           style={styles.chartSmall}
//           withInnerLines={true}
//           withOuterLines={true}
//           withHorizontalLabels={true}
//           withVerticalLabels={true}
//           withDots={false}
//           withShadow={false}
//           yAxisInterval={1}
//           bezier
//         />
//       </ScrollView>
//       <View style={styles.legendContainerSmall}>
//         {chartData.legend.map((label, index) => (
//           <View key={index} style={styles.legendItemSmall}>
//             <View style={[styles.legendColorSmall, { backgroundColor: chartData.datasets[index].color() }]} />
//             <Text style={styles.legendTextSmall}>{label}</Text>
//           </View>
//         ))}
//       </View>
//     </View>
//   );
// };

// const BridgeDashboard: React.FC = () => {
//   const navigation = useNavigation();
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [currentLocation, setCurrentLocation] = useState<LocationState | null>(null);
//   const [videoInfo, setVideoInfo] = useState<VideoData | null>(null);
//   const [fetchError, setFetchError] = useState<string | null>(null);
//   const [chartPage, setChartPage] = useState(0);
//   const [chartsPerPage] = useState(10);
//   const [predictions, setPredictions] = useState<PredictionResult[]>([]);
//   const [isPredicting, setIsPredicting] = useState(false);
//   const [isMapFullScreen, setIsMapFullScreen] = useState(false);

//   const MILES_TO_METERS = 1609.34;
//   const SEGMENT_LENGTH_MILES = 0.1;
//   const SEGMENT_LENGTH_METERS = SEGMENT_LENGTH_MILES * MILES_TO_METERS;
//   const KMH_TO_MS = 0.277778;

//   useEffect(() => {
//     let isMounted = true;

//     const fetchVideoData = async () => {
//       try {
//         const db = getDatabase();
//         const videosRef = ref(db, "videos");
//         const snapshot = await get(videosRef);

//         if (!snapshot.exists()) {
//           setFetchError("No video data available");
//           return;
//         }

//         const videos = snapshot.val();
//         const matchingVideo = Object.values(videos).find((video: any) => video.projectId) as VideoData | undefined;

//         if (matchingVideo) {
//           setVideoInfo(matchingVideo);
//         } else {
//           setFetchError("No matching project found");
//         }
//       } catch (err) {
//         console.error("Error fetching video data:", err);
//         setFetchError("Failed to fetch video data");
//       } finally {
//         if (isMounted) setIsLoading(false);
//       }
//     };

//     const getLocation = async () => {
//       try {
//         const { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== "granted") {
//           Alert.alert("Permission Denied", "Location permission is required.");
//           return;
//         }
//         const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
//         if (isMounted) {
//           setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
//         }
//       } catch (err) {
//         setError("Failed to get location");
//         Alert.alert("Error", "Failed to get your current location");
//       }
//     };

//     fetchVideoData();
//     getLocation();

//     return () => {
//       isMounted = false;
//     };
//   }, []);

//   const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
//     const R = 6371000;
//     const φ1 = (lat1 * Math.PI) / 180;
//     const φ2 = (lat2 * Math.PI) / 180;
//     const Δφ = ((lat2 - lat1) * Math.PI) / 180;
//     const Δλ = ((lon2 - lon1) * Math.PI) / 180;

//     const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     return R * c;
//   };

//   const processDataIntoSegments = (videoData: VideoData): SegmentData[] => {
//     let segments: SegmentData[] = [];
//     if (!videoData.speedData || !videoData.sensorData || videoData.speedData.length === 0 || videoData.sensorData.length === 0) {
//       return segments;
//     }

//     let currentDistance = 0;
//     let segmentStartIndex = 0;
//     const sortedSpeedData = [...videoData.speedData].sort(
//       (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
//     );

//     for (let i = 1; i < sortedSpeedData.length; i++) {
//       const prevPoint = sortedSpeedData[i - 1];
//       const currentPoint = sortedSpeedData[i];
//       const distance = calculateDistance(
//         prevPoint.location.latitude,
//         prevPoint.location.longitude,
//         currentPoint.location.latitude,
//         currentPoint.location.longitude
//       );

//       currentDistance += distance;
//       if (currentDistance >= SEGMENT_LENGTH_METERS || i === sortedSpeedData.length - 1) {
//         const segmentPoints = sortedSpeedData.slice(segmentStartIndex, i + 1);
//         const segmentTimestamp = new Date(segmentPoints[0].timestamp).getTime();
//         const segmentAccData = videoData.sensorData.filter((sensorPoint) => {
//           const sensorTime = new Date(sensorPoint.timestamp).getTime();
//           return (
//             sensorTime >= segmentTimestamp &&
//             sensorTime <= new Date(segmentPoints[segmentPoints.length - 1].timestamp).getTime()
//           );
//         });

//         if (segmentAccData.length > 0 && segmentPoints.length > 0) {
//           const avgAccZ = segmentAccData.reduce((sum, point) => sum + point.accelerometer.z, 0) / segmentAccData.length;
//           const avgSpeed = (segmentPoints.reduce((sum, point) => sum + point.speed, 0) / segmentPoints.length) * KMH_TO_MS;
//           segments.push({
//             accelerationZ: avgAccZ,
//             speedv: avgSpeed,
//             unixTimestamp: Math.floor(segmentTimestamp / 1000),
//             latitude: segmentPoints[0].location.latitude,
//             longitude: segmentPoints[0].location.longitude,
//           });
//         }
//         currentDistance = 0;
//         segmentStartIndex = i;
//       }
//     }
//     return segments;
//   };

//   const processPrediction = async (data: SegmentData): Promise<number> => {
//     try {
//       const response = await fetch("https://roadsense.onrender.com/predict", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           accelerationZ: [data.accelerationZ],
//           speedv: [data.speedv],
//           unixTimestamp: [data.unixTimestamp],
//           latitude: [data.latitude],
//           longitude: [data.longitude],
//         }),
//       });

//       if (!response.ok) throw new Error("Network response was not ok");
//       const result = await response.json();
//       return Number(result.predictions?.[0] ?? 0);
//     } catch (error) {
//       console.error("Error in processPrediction:", error);
//       return 0;
//     }
//   };

//   const handlePredictions = async () => {
//     if (!videoInfo) {
//       Alert.alert("Error", "No video data available");
//       return;
//     }

//     setIsPredicting(true);
//     try {
//       const segments = processDataIntoSegments(videoInfo);
//       if (segments.length === 0) throw new Error("No valid segments found in the data");

//       const results: PredictionResult[] = [];
//       let totalDistance = 0;

//       for (const segment of segments) {
//         const prediction = await processPrediction(segment);
//         results.push({
//           segment,
//           prediction: Number(prediction),
//           distanceStart: totalDistance,
//           distanceEnd: totalDistance + SEGMENT_LENGTH_MILES,
//         });
//         totalDistance += SEGMENT_LENGTH_MILES;
//       }
//       setPredictions(results);
//     } catch (err: any) {
//       Alert.alert("Error", `Failed to process predictions: ${err.message}`);
//     } finally {
//       setIsPredicting(false);
//     }
//   };

//   const toggleMapSize = () => setIsMapFullScreen(!isMapFullScreen);

//   const locations = videoInfo?.speedData
//     ? videoInfo.speedData
//         .map((data) => ({
//           latitude: data.location.latitude,
//           longitude: data.location.longitude,
//         }))
//         .filter((loc) => loc.latitude && loc.longitude && !isNaN(loc.latitude) && !isNaN(loc.longitude))
//     : [];

//   const totalPages = Math.ceil((videoInfo?.sensorData?.length || 0) / chartsPerPage);
//   const currentSensorData = videoInfo?.sensorData?.slice(chartPage * chartsPerPage, (chartPage + 1) * chartsPerPage) || [];

//   if (error) {
//     return (
//       <SafeAreaView style={styles.container}>
//         <ScrollView contentContainerStyle={styles.scrollContent}>
//           <Text style={styles.errorText}>{error}</Text>
//           <TouchableOpacity onPress={() => setError(null)} style={styles.retryButton}>
//             <Text style={styles.retryButtonText}>Retry</Text>
//           </TouchableOpacity>
//         </ScrollView>
//       </SafeAreaView>
//     );
//   }

//   if (isLoading) {
//     return (
//       <SafeAreaView style={styles.container}>
//         <ActivityIndicator size="large" color="#000000" />
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       {/* Header */}
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//           <MaterialCommunityIcons name="arrow-left" size={24} color="#000000" />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Project Dashboard</Text>
//       </View>

//       <View style={styles.contentWrapper}>
//         <ScrollView 
//           contentContainerStyle={styles.scrollContent} 
//           showsVerticalScrollIndicator={false}
//           scrollEnabled={!isMapFullScreen}
//         >
//           {/* Map Component */}
//           <View style={[styles.mapContainer, isMapFullScreen && styles.mapContainerFullScreen]}>
//             <MapView
//               style={styles.map}
//               initialRegion={{
//                 latitude: currentLocation?.latitude || locations[0]?.latitude || 0,
//                 longitude: currentLocation?.longitude || locations[0]?.longitude || 0,
//                 latitudeDelta: 0.0922,
//                 longitudeDelta: 0.0421,
//               }}
//               showsUserLocation={true}
//             >
//               {locations.map((location, index) => (
//                 <Marker
//                   key={index}
//                   coordinate={{ latitude: location.latitude, longitude: location.longitude }}
//                   title={`Data Point ${index + 1}`}
//                 />
//               ))}
//               <Polyline coordinates={locations} strokeColor="#000000" strokeWidth={4} />
//             </MapView>
//             {/* Show zoom button only in normal mode, inside map */}
//             {!isMapFullScreen && (
//               <TouchableOpacity 
//                 style={styles.zoomButtonInsideMap}
//                 onPress={toggleMapSize}
//               >
//                 <MaterialCommunityIcons
//                   name="arrow-expand"
//                   size={24}
//                   color="#FFFFFF"
//                 />
//               </TouchableOpacity>
//             )}
//           </View>

//           {/* IRI Prediction Section */}
//           {!isMapFullScreen && (
//             <>
//               <TouchableOpacity style={styles.predictButton} onPress={handlePredictions} disabled={isPredicting}>
//                 <MaterialCommunityIcons name="chart-bell-curve" size={20} color="#FFFFFF" />
//                 <Text style={styles.predictText}>{isPredicting ? "Processing..." : "Generate IRI Predictions"}</Text>
//               </TouchableOpacity>
//               {predictions.length > 0 && (
//                 <View style={styles.chartContainer}>
//                   <Text style={styles.chartTitle}>IRI Predictions</Text>
//                   <Text style={styles.chartSubtitle}>Roughness Index (m/km) over Distance (miles)</Text>
//                   <LineChart
//                     data={{
//                       labels: predictions.map((p) => p.distanceStart.toFixed(1)),
//                       datasets: [
//                         { data: predictions.map((p) => p.prediction), color: () => "#6200EE", strokeWidth: 2 },
//                       ],
//                     }}
//                     width={width - 32}
//                     height={220}
//                     chartConfig={{
//                       backgroundColor: "#ffffff",
//                       backgroundGradientFrom: "#ffffff",
//                       backgroundGradientTo: "#ffffff",
//                       decimalPlaces: 1,
//                       color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
//                       labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
//                       style: { borderRadius: 16 },
//                       propsForDots: { r: "4", strokeWidth: "2", stroke: "#6200EE" },
//                     }}
//                     bezier
//                     style={styles.chart}
//                     yAxisSuffix=" m/km"
//                     xAxisLabel="Mile "
//                     fromZero
//                   />
//                 </View>
//               )}

//               {/* Sensor Data Section */}
//               {currentSensorData.length > 0 && (
//                 <>
//                   <SensorChart sensorData={currentSensorData} sensorType="accelerometer" title="Accelerometer Data" />
//                   <SensorChart sensorData={currentSensorData} sensorType="gyroscope" title="Gyroscope Data" />
//                 </>
//               )}

//               {/* Pagination Controls */}
//               {totalPages > 1 && (
//                 <View style={styles.paginationContainer}>
//                   <TouchableOpacity
//                     onPress={() => setChartPage(Math.max(chartPage - 1, 0))}
//                     disabled={chartPage === 0}
//                     style={[styles.paginationButton, chartPage === 0 && styles.disabledButton]}
//                   >
//                     <MaterialCommunityIcons name="chevron-left" size={16} color="#FFFFFF" />
//                   </TouchableOpacity>
//                   <Text style={styles.pageText}>Page {chartPage + 1} of {totalPages}</Text>
//                   <TouchableOpacity
//                     onPress={() => setChartPage(Math.min(chartPage + 1, totalPages - 1))}
//                     disabled={chartPage === totalPages - 1}
//                     style={[styles.paginationButton, chartPage === totalPages - 1 && styles.disabledButton]}
//                   >
//                     <MaterialCommunityIcons name="chevron-right" size={16} color="#FFFFFF" />
//                   </TouchableOpacity>
//                 </View>
//               )}
//             </>
//           )}
//         </ScrollView>

//         {/* Show collapse button only in full-screen mode, as overlay */}
//         {isMapFullScreen && (
//           <TouchableOpacity 
//             style={styles.zoomButtonOverlay}
//             onPress={toggleMapSize}
//           >
//             <MaterialCommunityIcons
//               name="arrow-collapse"
//               size={24}
//               color="#FFFFFF"
//             />
//           </TouchableOpacity>
//         )}
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: { 
//     flex: 1, 
//     backgroundColor: '#F8F9FA' 
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 16,
//     backgroundColor: 'white',
//     borderBottomWidth: 1,
//     borderBottomColor: '#E0E0E0',
//     zIndex: 2000,
//   },
//   backButton: { marginRight: 12 },
//   headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
//   contentWrapper: {
//     flex: 1,
//     position: 'relative',
//   },
//   scrollContent: { 
//     flexGrow: 1, 
//     padding: 16,
//   },
//   mapContainer: {
//     height: 400,
//     marginBottom: 16,
//     borderRadius: 16,
//     overflow: 'hidden',
//     backgroundColor: 'white',
//     position: 'relative', // Needed for absolute positioning of button inside
//     ...Platform.select({
//       ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
//       android: { elevation: 4 },
//     }),
//   },
//   mapContainerFullScreen: {
//     height: height - 80,
//     marginBottom: 0,
//     borderRadius: 0,
//   },
//   map: { 
//     ...StyleSheet.absoluteFillObject,
//     zIndex: 0,
//   },
//   zoomButtonInsideMap: {
//     position: 'absolute',
//     bottom: 20,
//     right: 20,
//     backgroundColor: 'rgba(0, 0, 0, 0.8)',
//     padding: 12,
//     borderRadius: 25,
//     zIndex: 1000,
//     elevation: 10,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.3,
//     shadowRadius: 4,
//   },
//   zoomButtonOverlay: {
//     position: 'absolute',
//     bottom: 20,
//     right: 20,
//     backgroundColor: 'rgba(0, 0, 0, 0.8)',
//     padding: 12,
//     borderRadius: 25,
//     zIndex: 1000,
//     elevation: 10,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.3,
//     shadowRadius: 4,
//   },
//   chartContainer: {
//     backgroundColor: 'white',
//     borderRadius: 16,
//     padding: 16,
//     marginBottom: 16,
//     ...Platform.select({
//       ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
//       android: { elevation: 4 },
//     }),
//   },
//   chartContainerSmall: {
//     backgroundColor: 'white',
//     borderRadius: 16,
//     padding: 12,
//     marginBottom: 16,
//     ...Platform.select({
//       ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
//       android: { elevation: 4 },
//     }),
//   },
//   chartScrollView: { width: '100%' },
//   chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
//   chartTitleSmall: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 2 },
//   chartSubtitle: { fontSize: 12, color: '#666', marginBottom: 8 },
//   chartSubtitleSmall: { fontSize: 10, color: '#666', marginBottom: 4 },
//   chart: { borderRadius: 8 },
//   chartSmall: { borderRadius: 8 },
//   legendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
//   legendContainerSmall: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
//   legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
//   legendItemSmall: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
//   legendColor: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
//   legendColorSmall: { width: 8, height: 8, borderRadius: 4, marginRight: 3 },
//   legendText: { fontSize: 12, color: '#666' },
//   legendTextSmall: { fontSize: 10, color: '#666' },
//   predictButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: '#000000',
//     paddingVertical: 14,
//     borderRadius: 12,
//     marginBottom: 16,
//     ...Platform.select({
//       ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4 },
//       android: { elevation: 3 },
//     }),
//   },
//   predictText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
//   paginationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
//   paginationButton: {
//     backgroundColor: '#000000',
//     padding: 6,
//     borderRadius: 8,
//     ...Platform.select({
//       ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
//       android: { elevation: 2 },
//     }),
//   },
//   disabledButton: { backgroundColor: '#CCCCCC' },
//   pageText: { fontSize: 14, color: '#333' },
//   errorText: { color: 'red', textAlign: 'center', fontSize: 16 },
//   retryButton: {
//     backgroundColor: '#000000',
//     paddingVertical: 12,
//     paddingHorizontal: 20,
//     borderRadius: 12,
//     marginTop: 16,
//     ...Platform.select({
//       ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4 },
//       android: { elevation: 3 },
//     }),
//   },
//   retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
// });

// export default BridgeDashboard;

