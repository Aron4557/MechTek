import React, { useState } from 'react';
import {
  View, Text, SafeAreaView, StatusBar, StyleSheet,
  TouchableOpacity, TextInput, ScrollView, Image,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

// ─── Cloudinary config (from .env) ────────────────────────────────────────────
const CLOUD_NAME    = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

// ─── Theme ────────────────────────────────────────────────────────────────────
const YELLOW  = '#F5A623';
const TEAL    = '#0D7377';
const PURPLE  = '#7C3AED';

const T = {
  bg:       '#F8FAFC',
  card:     '#FFFFFF',
  input:    '#F1F5F9',
  text:     '#0F172A',
  subtext:  '#334155',
  muted:    '#64748B',
  border:   '#E2E8F0',
  headerBg: '#FFFFFF',
};

const MACHINES = [
  { id: 'machine-001', name: 'Crusher Unit C-04',    icon: 'cog-outline' },
  { id: 'machine-002', name: 'Conveyor Belt B-12',   icon: 'repeat-outline' },
  { id: 'machine-003', name: 'Pump Station P-07',    icon: 'water-outline' },
  { id: 'machine-004', name: 'Drill Unit D-01',      icon: 'construct-outline' },
  { id: 'machine-005', name: 'Compressor Unit A-03', icon: 'pulse-outline' },
  { id: 'machine-006', name: 'Hydraulic Press H-09', icon: 'hardware-chip-outline' },
];

const SEVERITIES = [
  { label: 'Low',      color: '#16a34a' },
  { label: 'Medium',   color: '#D97706' },
  { label: 'High',     color: '#EA580C' },
  { label: 'Critical', color: '#DC2626' },
];

const MAX_FILES = 5; // max attachments per report

// ─── Upload a single file to Cloudinary ───────────────────────────────────────
async function uploadToCloudinary(uri, type = 'image', onProgress) {
  // Compress images before upload
  let finalUri = uri;
  if (type === 'image') {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );
    finalUri = compressed.uri;
  }

  const formData = new FormData();
  formData.append('file', {
    uri:  finalUri,
    type: type === 'video' ? 'video/mp4' : 'image/jpeg',
    name: type === 'video' ? 'fault_video.mp4' : 'fault_image.jpg',
  });
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'faults');

  // Use XMLHttpRequest so we can track upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve({ url: data.secure_url, publicId: data.public_id, type });
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

export default function ReportFaultScreen({ navigation }) {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showMachineList, setShowMachineList] = useState(false);
  const [faultTitle, setFaultTitle]           = useState('');
  const [description, setDescription]         = useState('');
  const [severity, setSeverity]               = useState('');
  const [mediaFiles, setMediaFiles]           = useState([]); // [{ uri, type, uploaded, url, progress }]
  const [submitting, setSubmitting]           = useState(false);

  const user = auth.currentUser;

  // ─── Permission helper ──────────────────────────────────────────────────────
  const requestPermission = async (type) => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to take photos/videos.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is required to pick media.');
        return false;
      }
    }
    return true;
  };

  // ─── Add media to state & start upload ─────────────────────────────────────
  const addAndUpload = async (uri, type) => {
    if (mediaFiles.length >= MAX_FILES) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_FILES} files per report.`);
      return;
    }

    const id    = Date.now().toString();
    const entry = { id, uri, type, progress: 0, uploaded: false, url: null, error: null };

    setMediaFiles(prev => [...prev, entry]);

    try {
      const result = await uploadToCloudinary(uri, type, (progress) => {
        setMediaFiles(prev =>
          prev.map(f => f.id === id ? { ...f, progress } : f)
        );
      });

      setMediaFiles(prev =>
        prev.map(f => f.id === id ? { ...f, uploaded: true, url: result.url, progress: 100 } : f)
      );
    } catch (err) {
      console.log('Upload error:', err);
      setMediaFiles(prev =>
        prev.map(f => f.id === id ? { ...f, error: 'Upload failed. Tap to retry.' } : f)
      );
    }
  };

  // ─── Camera (photo) ─────────────────────────────────────────────────────────
  const handleCamera = async () => {
    if (!await requestPermission('camera')) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) addAndUpload(result.assets[0].uri, 'image');
  };

  // ─── Camera (video) ─────────────────────────────────────────────────────────
  const handleVideo = async () => {
    if (!await requestPermission('camera')) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    if (!result.canceled) addAndUpload(result.assets[0].uri, 'video');
  };

  // ─── Gallery ────────────────────────────────────────────────────────────────
  const handleGallery = async () => {
    if (!await requestPermission('gallery')) return;
    const remaining = MAX_FILES - mediaFiles.length;
    if (remaining <= 0) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_FILES} files per report.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (!result.canceled) {
      result.assets.forEach(asset => {
        const type = asset.type === 'video' ? 'video' : 'image';
        addAndUpload(asset.uri, type);
      });
    }
  };

  // ─── Remove media ───────────────────────────────────────────────────────────
  const removeMedia = (id) => {
    setMediaFiles(prev => prev.filter(f => f.id !== id));
  };

  // ─── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    if (!selectedMachine)    { Alert.alert('Missing Field', 'Please select a machine.');        return false; }
    if (!faultTitle.trim())  { Alert.alert('Missing Field', 'Please enter a fault title.');     return false; }
    if (!description.trim()) { Alert.alert('Missing Field', 'Please enter a description.');     return false; }
    if (!severity)           { Alert.alert('Missing Field', 'Please select a severity level.'); return false; }

    const stillUploading = mediaFiles.some(f => !f.uploaded && !f.error);
    if (stillUploading) {
      Alert.alert('Please Wait', 'Some files are still uploading. Please wait before submitting.');
      return false;
    }
    return true;
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const uploadedUrls = mediaFiles
        .filter(f => f.uploaded && f.url)
        .map(f => ({ url: f.url, type: f.type }));

      await addDoc(collection(db, 'faults'), {
        machineId:   selectedMachine.id,
        machineName: selectedMachine.name,
        title:       faultTitle.trim(),
        description: description.trim(),
        severity,
        status:      'Reported',
        reportedBy:  user.uid,
        mediaFiles:  uploadedUrls,
        imageUrls:   uploadedUrls.filter(m => m.type === 'image').map(m => m.url), // backwards compat
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });

      Alert.alert('Report Submitted', 'Your fault report has been submitted successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.log('Submit error:', e);
      Alert.alert('Failed', 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.headerBg} translucent={false} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <View style={styles.backIconWrap}>
            <Ionicons name="chevron-back" size={18} color={TEAL} />
          </View>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Report Fault</Text>
          <View style={styles.headerUnderline} />
        </View>

        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>3 Steps</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Step 1 — Select Machine ── */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: YELLOW + '18', borderColor: YELLOW + '55' }]}>
                <Text style={[styles.stepNum, { color: YELLOW }]}>1</Text>
              </View>
              <Text style={styles.stepTitle}>SELECT MACHINE</Text>
            </View>

            <TouchableOpacity
              style={[styles.dropdown, showMachineList && { borderColor: TEAL }]}
              onPress={() => setShowMachineList(!showMachineList)}
              activeOpacity={0.8}
            >
              {selectedMachine ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={selectedMachine.icon} size={18} color={TEAL} />
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{selectedMachine.name}</Text>
                </View>
              ) : (
                <Text style={{ color: T.muted, fontSize: 14 }}>Tap to select a machine...</Text>
              )}
              <Ionicons name={showMachineList ? 'chevron-up' : 'chevron-down'} size={16} color={showMachineList ? TEAL : T.muted} />
            </TouchableOpacity>

            {showMachineList && (
              <View style={styles.machineList}>
                {MACHINES.map((machine, index) => {
                  const isActive = selectedMachine?.id === machine.id;
                  return (
                    <TouchableOpacity
                      key={machine.id}
                      style={[
                        styles.machineItem,
                        isActive && { backgroundColor: TEAL + '10' },
                        index === MACHINES.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => { setSelectedMachine(machine); setShowMachineList(false); }}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isActive ? TEAL + '18' : T.input, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={machine.icon} size={16} color={isActive ? TEAL : T.muted} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: isActive ? '700' : '500', color: isActive ? TEAL : T.text }}>
                        {machine.name}
                      </Text>
                      {isActive && <Ionicons name="checkmark-circle" size={18} color={TEAL} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Step 2 — Fault Details ── */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: TEAL + '18', borderColor: TEAL + '44' }]}>
                <Text style={[styles.stepNum, { color: TEAL }]}>2</Text>
              </View>
              <Text style={styles.stepTitle}>FAULT DETAILS</Text>
            </View>

            <Text style={styles.fieldLabel}>Fault Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Bearing noise on main shaft"
              placeholderTextColor={T.muted}
              value={faultTitle}
              onChangeText={setFaultTitle}
              maxLength={80}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }]}
              placeholder="Describe the fault in detail..."
              placeholderTextColor={T.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={{ fontSize: 11, color: T.muted, textAlign: 'right', marginBottom: 14 }}>{description.length}/500</Text>

            <Text style={styles.fieldLabel}>Severity Level</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {SEVERITIES.map(({ label, color }) => {
                const isActive = severity === label;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.severityBtn,
                      { borderColor: isActive ? color : T.border, backgroundColor: isActive ? color + '12' : T.input },
                    ]}
                    onPress={() => setSeverity(label)}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? color : T.muted }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Step 3 — Attach Media ── */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: PURPLE + '18', borderColor: PURPLE + '44' }]}>
                <Text style={[styles.stepNum, { color: PURPLE }]}>3</Text>
              </View>
              <Text style={styles.stepTitle}>ATTACH MEDIA</Text>
              <View style={{ marginLeft: 'auto', backgroundColor: PURPLE + '12', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: PURPLE + '33' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: PURPLE }}>{mediaFiles.length}/{MAX_FILES}</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {[
                { icon: 'camera-outline',   label: 'Camera',  onPress: handleCamera  },
                { icon: 'videocam-outline', label: 'Video',   onPress: handleVideo   },
                { icon: 'images-outline',   label: 'Gallery', onPress: handleGallery },
              ].map(({ icon, label, onPress }) => (
                <TouchableOpacity
                  key={label}
                  style={styles.mediaBtn}
                  onPress={onPress}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: PURPLE + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <Ionicons name={icon} size={20} color={PURPLE} />
                  </View>
                  <Text style={{ fontSize: 11, color: T.subtext, fontWeight: '600' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Media previews */}
            {mediaFiles.length > 0 && (
              <View style={styles.previewGrid}>
                {mediaFiles.map((file) => (
                  <View key={file.id} style={styles.previewItem}>
                    {/* Thumbnail */}
                    <Image
                      source={{ uri: file.uri }}
                      style={styles.previewThumb}
                      resizeMode="cover"
                    />

                    {/* Video badge */}
                    {file.type === 'video' && (
                      <View style={styles.videoBadge}>
                        <Ionicons name="play" size={10} color="#fff" />
                      </View>
                    )}

                    {/* Upload progress overlay */}
                    {!file.uploaded && !file.error && (
                      <View style={styles.previewOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 4 }}>
                          {file.progress}%
                        </Text>
                        {/* Progress bar */}
                        <View style={{ width: '80%', height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, marginTop: 4 }}>
                          <View style={{ width: `${file.progress}%`, height: 3, backgroundColor: '#fff', borderRadius: 2 }} />
                        </View>
                      </View>
                    )}

                    {/* Success tick */}
                    {file.uploaded && (
                      <View style={[styles.previewOverlay, { backgroundColor: 'transparent' }]}>
                        <View style={{ backgroundColor: '#16a34a', borderRadius: 10, padding: 3 }}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      </View>
                    )}

                    {/* Error state */}
                    {file.error && (
                      <View style={[styles.previewOverlay, { backgroundColor: 'rgba(220,38,38,0.7)' }]}>
                        <Ionicons name="alert-circle-outline" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center', marginTop: 2 }}>Failed</Text>
                      </View>
                    )}

                    {/* Remove button */}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeMedia(file.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={10} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {mediaFiles.length === 0 && (
              <View style={{ backgroundColor: T.input, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T.border }}>
                <Ionicons name="cloud-upload-outline" size={16} color={T.muted} />
                <Text style={{ fontSize: 12, color: T.muted, flex: 1, lineHeight: 18 }}>
                  Photos and videos upload instantly to Cloudinary. Up to {MAX_FILES} files per report.
                </Text>
              </View>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="send-outline" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit Fault Report</Text>
                </View>
              )
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 16, paddingBottom: 48 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 44 : 12,
    backgroundColor: T.headerBg,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backIconWrap:    { width: 32, height: 32, borderRadius: 10, backgroundColor: TEAL + '18', borderWidth: 1, borderColor: TEAL + '44', alignItems: 'center', justifyContent: 'center' },
  backText:        { color: TEAL, fontSize: 13, fontWeight: '700' },
  headerCenter:    { alignItems: 'center' },
  headerTitle:     { fontSize: 16, fontWeight: '800', color: T.text },
  headerUnderline: { height: 2, width: 28, backgroundColor: TEAL, borderRadius: 2, marginTop: 3 },
  headerBadge:     { backgroundColor: T.input, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.border },
  headerBadgeText: { color: T.muted, fontSize: 11, fontWeight: '700' },

  stepCard: {
    backgroundColor: T.card, borderRadius: 16, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  stepBadge:  { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepNum:    { fontSize: 13, fontWeight: '900' },
  stepTitle:  { fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 2 },

  dropdown: {
    backgroundColor: T.input, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderColor: T.border,
  },
  machineList: { backgroundColor: T.card, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  machineItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },

  fieldLabel: { fontSize: 12, color: TEAL, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 6 },
  input: {
    backgroundColor: T.input, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, color: T.text, fontSize: 14,
    marginBottom: 4, borderWidth: 1, borderColor: T.border,
  },
  severityBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', gap: 5 },

  // Media
  mediaBtn: {
    flex: 1, backgroundColor: T.input, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: T.border,
  },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  previewItem: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  previewThumb: { width: '100%', height: '100%' },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute', bottom: 5, left: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  removeBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  submitBtn:     { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});