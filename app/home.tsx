import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Image,
  RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  doc, 
  deleteDoc 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Modified Project interface with string status
interface Project {
  id: string;
  name: string;
  description?: string;
  date: string;
  status?: string; // Changed from 'active' | 'completed' to string
}

interface NewProject {
  name: string;
  description: string;
  date: string;
  status: string; // Changed from 'active' | 'completed' to string
}

const ProjectDashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newProject, setNewProject] = useState<NewProject>({
    name: '',
    description: '',
    date: '',
    status: 'active'
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const auth = getAuth();
  const db = getFirestore();

  // Load projects from Firestore
  const loadProjects = async () => {
    try {
      setError(null);
      const user = auth.currentUser;
      
      if (user) {
        const userId = user.uid;
        const projectsRef = collection(db, "users", userId, "projects");
        const q = query(projectsRef);
        const querySnapshot = await getDocs(q);
        
        const loadedProjects: Project[] = [];
        querySnapshot.forEach((doc) => {
          const projectData = doc.data();
          loadedProjects.push({
            id: doc.id,
            name: projectData.name,
            description: projectData.description,
            date: projectData.date,
            status: projectData.status
          });
        });
        
        setProjects(loadedProjects);
        setFilteredProjects(loadedProjects);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      setError("Failed to load projects. Please try again.");
      Alert.alert("Error", "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  // Load projects from Firestore when component mounts
  useEffect(() => {
    loadProjects();
  }, []);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(project => 
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProjects(filtered);
    }
  }, [searchQuery, projects]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const confirmDeleteProject = (project: Project) => {
    Alert.alert(
      `Delete ${project.name}?`,
      "This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: () => deleteProject(project),
          style: "destructive"
        },
      ]
    );
  };

  const deleteProject = async (project: Project) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("No user is currently signed in.");
        Alert.alert("Error", "User not authenticated.");
        return;
      }
      
      const projectRef = doc(
        db,
        "users",
        user.uid,
        "projects",
        project.id
      );
      
      await deleteDoc(projectRef);
      
      // Update local state
      const updatedProjects = projects.filter((p) => p.id !== project.id);
      setProjects(updatedProjects);
      setFilteredProjects(updatedProjects);
      
      Alert.alert("Success", "Project deleted successfully.");
    } catch (error) {
      console.error("Error deleting project:", error);
      Alert.alert("Error", "Could not delete project.");
    }
  };

  const handleCreateProject = async () => {
    // Validate inputs
    if (!newProject.name) {
      Alert.alert('Error', 'Project name is required');
      return;
    }

    try {
      setError(null);
      const user = auth.currentUser;
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a project');
        return;
      }
      
      const userId = user.uid;
      
      // Create new project object with current date
      const projectData = {
        name: newProject.name,
        description: newProject.description,
        date: new Date().toISOString().split('T')[0],
        status: 'active'
      };
      
      // Save project to Firestore under the user's projects subcollection
      const docRef = await addDoc(
        collection(db, "users", userId, "projects"),
        projectData
      );
      
      // Get the document ID generated by Firestore
      const projectId = docRef.id;
      
      // Create project object with ID for local state
      const project: Project = {
        id: projectId,
        ...projectData
      };
      
      // Add to projects list
      const updatedProjects = [...projects, project];
      setProjects(updatedProjects);
      setFilteredProjects(updatedProjects);
      
      // Reset form and close modal
      setNewProject({ name: '', description: '', date: '', status: 'active' });
      setModalVisible(false);
      
      // Navigate to video screen with project ID
      router.push({
        pathname: "/video",
        params: { projectId: projectId } // Pass the project ID as a parameter
      });
      
    } catch (error) {
      console.error("Error creating project:", error);
      setError("Failed to save project. Please try again.");
      Alert.alert("Error", "Failed to create project");
    }
  };

  const renderProjectItem = ({ item }: { item: Project }) => (
    <TouchableOpacity 
      style={styles.projectItem}
      onPress={() => router.push({
        pathname: "/dashboard",
        params: { projectId: item.id }
      })}
    >
      <View style={styles.projectHeader}>
        <View style={styles.projectStatusBadge}>
          <View 
            style={[
              styles.statusIndicator, 
              item.status === 'active' ? styles.activeStatus : styles.completedStatus
            ]} 
          />
          <Text style={styles.statusText}>
            {item.status === 'active' ? 'Active' : 'Completed'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => confirmDeleteProject(item)}
        >
          <MaterialIcons name="delete-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.projectName}>{item.name}</Text>
      
      <View style={styles.projectDetails}>
        <View style={styles.detailItem}>
          <MaterialIcons name="calendar-today" size={16} color="#6C63FF" />
          <Text style={styles.detailText}>{item.date}</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.viewButton}
        onPress={() => router.push({
          pathname: "/video",
          params: { projectId: item.id }
        })}
      >
        <Text style={styles.viewButtonText}>View Details</Text>
        <MaterialIcons name="arrow-forward" size={16} color="#6C63FF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F8FF" />
      
      <View style={styles.header}>
        <View>
          {/* <Text style={styles.greeting}>Hello, User</Text> */}
          <Text style={styles.title}>RoadSense</Text>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <Image 
            source={{ uri: 'https://via.placeholder.com/40' }} 
            style={styles.profileImage}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#A0A0A0" />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search projects..." 
            placeholderTextColor="#A0A0A0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color="#A0A0A0" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <MaterialIcons name="filter-list" size={22} color="black" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.contentContainer}>
        <Text style={styles.sectionTitle}>
          {searchQuery ? `Search Results (${filteredProjects.length})` : 'Your Projects'}
        </Text>
        
        {filteredProjects.length > 0 ? (
          <FlatList
            data={filteredProjects}
            renderItem={renderProjectItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#6C63FF']}
                tintColor={'#6C63FF'}
              />
            }
          />
        ) : (
          <View style={styles.emptyState}>
            {searchQuery ? (
              <>
                <Image 
                  source={{ uri: 'https://via.placeholder.com/150' }}
                  style={styles.emptyImage}
                />
                <Text style={styles.emptyText}>No matching projects</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </>
            ) : (
              <>
                <Image 
                  source={{ uri: 'https://via.placeholder.com/150' }}
                  style={styles.emptyImage}
                />
                <Text style={styles.emptyText}>No projects yet</Text>
                <Text style={styles.emptySubtext}>Tap the + button to create your first project</Text>
              </>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => setModalVisible(true)}
      >
        <MaterialIcons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* New Project Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Project</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formDivider} />
            
            <Text style={styles.inputLabel}>Project Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter a name for your project"
              placeholderTextColor="#A0A0A0"
              value={newProject.name}
              onChangeText={(text) => setNewProject({...newProject, name: text})}
            />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your project (optional)"
              placeholderTextColor="#A0A0A0"
              multiline
              numberOfLines={4}
              value={newProject.description}
              onChangeText={(text) => setNewProject({...newProject, description: text})}
            />
            
            <TouchableOpacity 
              style={styles.createProjectButton}
              onPress={handleCreateProject}
            >
              <Text style={styles.createProjectButtonText}>Create Project</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#F5F8FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImage: {
    width: 40,
    height: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  searchBar: {
    flex: 1,
    height: 46,
    backgroundColor: 'white',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    paddingLeft: 8,
    fontSize: 15,
    color: '#333',
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    marginHorizontal: 24,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
  },
  listContainer: {
    paddingBottom: 80,
  },
  projectItem: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  projectStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  activeStatus: {
    backgroundColor: '#6C63FF',
  },
  completedStatus: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  deleteButton: {
    padding: 5,
  },
  projectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
  },
  projectDetails: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
    marginRight: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyImage: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  createButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  formDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F8FF',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#333',
    marginBottom: 20,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  createProjectButton: {
    backgroundColor: 'black',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  createProjectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProjectDashboard;