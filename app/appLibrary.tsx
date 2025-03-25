// AppLibraryScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { db, database } from '../FirebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { ref, set } from 'firebase/database';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Match the directory structure with VideoPreviewSection
const VIDEOS_DIRECTORY = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}saved_videos/` : '';
const VIDEOS_INFO_FILE = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}videos_index.json` : '';

interface VideoItem {
    uri: string;
    status: string;
    userId: string;
    projectId: string;
    createdAt?: string;
    sensorData?: {
        timestamp: string;
        accelerometer: { x: number; y: number; z: number };
        gyroscope: { x: number; y: number; z: number };
    }[];
    speedData?: {
        timestamp: string;
        speed: number;
        location: {
            latitude: number;
            longitude: number;
        };
    }[];
}

const AppLibraryScreen: React.FC = () => {
    const router = useRouter();
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [uploadingVideoUri, setUploadingVideoUri] = useState<string | null>(null);

    useEffect(() => {
        if (FileSystem.documentDirectory) {
            ensureDirectoryExists();
            fetchVideos();
        }
    }, []);

    const ensureDirectoryExists = async () => {
        const dirInfo = await FileSystem.getInfoAsync(VIDEOS_DIRECTORY);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(VIDEOS_DIRECTORY, { intermediates: true });
        }
    };

    const fetchVideos = async () => {
        try {
            setLoading(true);
            const auth = getAuth();
            const user = auth.currentUser;

            if (!user) {
                setVideos([]);
                return;
            }

            const fileInfo = await FileSystem.getInfoAsync(VIDEOS_INFO_FILE);
            if (!fileInfo.exists) {
                setVideos([]);
                return;
            }

            const content = await FileSystem.readAsStringAsync(VIDEOS_INFO_FILE);
            const allVideos: VideoItem[] = JSON.parse(content);
            const userVideos = allVideos.filter(video => video.userId === user.uid);
            
            // Sort videos by createdAt date (newest first)
            userVideos.sort((a, b) => {
                return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
            });
            
            setVideos(userVideos);
        } catch (error) {
            console.error('Error fetching videos:', error);
            Alert.alert('Error', 'Failed to load videos from storage');
            setVideos([]);
        } finally {
            setLoading(false);
        }
    };

    const saveVideosInfo = async (updatedVideos: VideoItem[]) => {
        try {
            const fileInfo = await FileSystem.getInfoAsync(VIDEOS_INFO_FILE);
            let allVideos: VideoItem[] = [];
            
            if (fileInfo.exists) {
                const content = await FileSystem.readAsStringAsync(VIDEOS_INFO_FILE);
                allVideos = JSON.parse(content);
            }
            
            const auth = getAuth();
            const user = auth.currentUser;
            if (!user) return;
            
            const otherVideos = allVideos.filter(video => video.userId !== user.uid);
            const newAllVideos = [...otherVideos, ...updatedVideos];
            
            await FileSystem.writeAsStringAsync(VIDEOS_INFO_FILE, JSON.stringify(newAllVideos));
        } catch (error) {
            console.error('Error saving videos info:', error);
        }
    };

    const handleDeleteVideo = async (uri: string) => {
        Alert.alert(
            "Delete Video", 
            "Are you sure you want to delete this video?", 
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const fileInfo = await FileSystem.getInfoAsync(uri);
                            if (fileInfo.exists) {
                                await FileSystem.deleteAsync(uri);
                            }
                            
                            const updatedVideos = videos.filter(video => video.uri !== uri);
                            setVideos(updatedVideos);
                            await saveVideosInfo(updatedVideos);
                            
                            Alert.alert("Success", "Video successfully deleted");
                        } catch (error) {
                            console.error('Error deleting video:', error);
                            Alert.alert("Error", "Failed to delete the video");
                        }
                    }
                }
            ]
        );
    };

    const handleUploadVideo = async (videoItem: VideoItem) => {
        setUploadingVideoUri(videoItem.uri);
        const { uri, sensorData, speedData, projectId } = videoItem;

        try {
            const auth = getAuth();
            const user = auth.currentUser;

            if (user) {
                const timestamp = Date.now().toString();

                const videoData = {
                    uri,
                    status: 'uploaded',
                    userId: user.uid,
                    createdAt: new Date().toISOString(),
                    projectId: projectId
                };

                const firestoreRef = doc(db, 'videos', timestamp);
                await setDoc(firestoreRef, videoData);

                const videoMetadata = {
                    uri,
                    userId: user.uid,
                    createdAt: new Date().toISOString(),
                    projectId: projectId,
                    sensorData: sensorData,
                    speedData: speedData
                };

                const videoRef = ref(database, `videos/${timestamp}`);
                await set(videoRef, videoMetadata);

                const updatedVideos = videos.map(video =>
                    video.uri === uri ? { ...video, status: 'uploaded' } : video
                );
                setVideos(updatedVideos);
                await saveVideosInfo(updatedVideos);

                Alert.alert("Success", "Video and data uploaded successfully!");
            } else {
                Alert.alert("Error", "You must be logged in to upload videos");
            }
        } catch (error) {
            console.error('Error uploading video:', error);
            Alert.alert("Upload Failed", "There was an error uploading the video");
        } finally {
            setUploadingVideoUri(null);
        }
    };

    const formatCreatedDate = (dateStr?: string) => {
        if (!dateStr) return 'Unknown date';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const renderVideoCard = ({ item }: { item: VideoItem }) => {
        const isCurrentlyUploading = item.uri === uploadingVideoUri;
        
        return (
            <View style={styles.card}>
                <Video
                    source={{ uri: item.uri }}
                    style={styles.video}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                />
                <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                    style={styles.videoOverlay}
                >
                    <View style={styles.dateContainer}>
                        <MaterialIcons name="date-range" size={14} color="white" />
                        <Text style={styles.dateText}>{formatCreatedDate(item.createdAt)}</Text>
                    </View>
                </LinearGradient>
                
                <BlurView intensity={80} tint="dark" style={styles.cardContent}>
                    <View style={styles.cardInfo}>
                        <View style={styles.statusContainer}>
                            <Text style={styles.statusLabel}>Status:</Text>
                            <View style={[
                                styles.statusBadge, 
                                item.status === 'uploaded' ? styles.uploadedBadge : styles.pendingBadge
                            ]}>
                                <Text style={styles.statusText}>
                                    {item.status === 'uploaded' ? 'Uploaded' : 'Pending'}
                                </Text>
                            </View>
                        </View>
                        
                        <Text style={styles.projectId}>
                            Project ID: {item.projectId || 'Unknown'}
                        </Text>
                    </View>
                    
                    <View style={styles.actions}>
                        {item.status !== 'uploaded' && (
                            <TouchableOpacity
                                onPress={() => handleUploadVideo(item)}
                                style={[styles.actionButton, styles.uploadButton]}
                                disabled={isCurrentlyUploading || loading}
                            >
                                {isCurrentlyUploading ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="cloud-upload" size={20} color="white" />
                                        <Text style={styles.buttonText}>Upload</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity
                            onPress={() => handleDeleteVideo(item.uri)}
                            style={[styles.actionButton, styles.deleteButton]}
                            disabled={isCurrentlyUploading || loading}
                        >
                            <Ionicons name="trash" size={20} color="white" />
                            <Text style={styles.buttonText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Library</Text>
            </View>
            
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007BFF" />
                    <Text style={styles.loadingText}>Loading videos...</Text>
                </View>
            ) : (
                <View style={styles.contentContainer}>
                    <FlatList
                        data={videos}
                        keyExtractor={(item) => item.uri}
                        renderItem={renderVideoCard}
                        contentContainerStyle={styles.listContainer}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="videocam-off" size={60} color="#ccc" />
                                <Text style={styles.emptyText}>No videos in your library</Text>
                                <Text style={styles.emptySubtext}>
                                    Videos you record will appear here
                                </Text>
                            </View>
                        }
                    />
                    <TouchableOpacity
                        style={styles.projectButton}
                        onPress={() => router.push('/home')}
                    >
                        <Text style={styles.projectButtonText}>Go to Project</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    contentContainer: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eeeeee',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    listContainer: {
        padding: 16,
        paddingBottom: 80,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginBottom: 20,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    video: {
        width: '100%',
        height: 220,
        backgroundColor: '#222',
    },
    videoOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        justifyContent: 'flex-end',
        paddingHorizontal: 12,
        paddingBottom: 8,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        color: 'white',
        fontSize: 12,
        marginLeft: 4,
    },
    cardContent: {
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    cardInfo: {
        marginBottom: 12,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    statusLabel: {
        fontSize: 14,
        color: 'white',
        marginRight: 6,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    uploadedBadge: {
        backgroundColor: '#4CAF50',
    },
    pendingBadge: {
        backgroundColor: '#FF9800',
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '500',
    },
    projectId: {
        fontSize: 13,
        color: 'white',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginLeft: 8,
    },
    uploadButton: {
        backgroundColor: '#007BFF',
    },
    deleteButton: {
        backgroundColor: '#dc3545',
    },
    buttonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 6,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#555',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#555',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#888',
        marginTop: 8,
    },
    projectButton: {
        backgroundColor: 'black',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 50,
    },
    projectButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default AppLibraryScreen;