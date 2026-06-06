// Technician dashboard//

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, SafeAreaView, StatusBar, Platform,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
  ScrollView, Modal, TextInput, KeyboardAvoidingView, Switch,
  StyleSheet, Image, Dimensions, FlatList, Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { signOut } from 'firebase/auth';
import {
  collection, query, where, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

// ─── Cloudinary config ────────────────────────────────────────────────────────
const CLOUD_NAME    = 'dmp6du0th';
const UPLOAD_PRESET = 'fault_reports';
const UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

// ─── Theme ────────────────────────────────────────────────────────────────────
const YELLOW = '#F5A623';
const TEAL   = '#0D7377';

const LIGHT = {
  bg: '#F8FAFC', card: '#FFFFFF', input: '#F1F5F9',
  text: '#0F172A', subtext: '#334155', muted: '#64748B',
  border: '#E2E8F0', statusBar: 'dark-content', headerBg: '#FFFFFF',
};
const DARK = {
  bg: '#0F172A', card: '#1E293B', input: '#0F3460',
  text: '#F8FAFC', subtext: '#94A3B8', muted: '#64748B',
  border: '#1E293B', statusBar: 'light-content', headerBg: '#1E293B',
};

const SEV_COLOR = { Low: '#16a34a', Medium: '#D97706', High: '#EA580C', Critical: '#DC2626' };
const STA_COLOR = { Reported: '#2563EB', Repairing: '#D97706', Fixed: '#16a34a' };
const STATUS_OPTIONS = ['Reported', 'Repairing', 'Fixed'];
const MAX_REPAIR_IMAGES = 4;
const { width: SW, height: SH } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - (ts.toDate?.()?.getTime() || ts)) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}
function getInitial(name = '') { return name.trim().charAt(0).toUpperCase() || '?'; }

// detect if a URL is a video by extension or cloudinary resource type
function isVideoUrl(url = '') {
  return /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(url) || url.includes('/video/upload/');
}

// ─── Full-screen image viewer ─────────────────────────────────────────────────
function ImageViewerModal({ images, startIndex = 0, visible, onClose }) {
  const [current, setCurrent] = useState(startIndex);
  const flatRef = useRef(null);

  useEffect(() => {
    if (visible) setCurrent(startIndex);
  }, [visible, startIndex]);

  const onScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    setCurrent(idx);
  };

  if (!images.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>

        {/* Top bar */}
        <View style={{
          position: 'absolute', top: Platform.OS === 'android' ? 44 : 56,
          left: 0, right: 0, zIndex: 10,
          flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between', paddingHorizontal: 16,
        }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{current + 1} / {images.length}</Text>
          </View>
        </View>

        {/* Swipeable images */}
        <FlatList
          ref={flatRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => (
            <View style={{ width: SW, height: SH, alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={{ uri: item }}
                style={{ width: SW, height: SH * 0.82 }}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {/* Dot indicators */}
        {images.length > 1 && (
          <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {images.map((_, i) => (
              <View key={i} style={{ width: i === current ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === current ? '#fff' : 'rgba(255,255,255,0.35)' }} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Clickable media thumbnail (photo = open viewer, video = open in browser) ──
function MediaThumb({ uri, type, allImages, imageIndex, onPhotoPress, size = 72, showRemove, onRemove, progress, uploaded, error }) {
  const isVid = type === 'video' || isVideoUrl(uri);

  const handlePress = () => {
    if (isVid) {
      Linking.openURL(uri).catch(() => Alert.alert('Error', 'Could not open video URL.'));
    } else {
      onPhotoPress && onPhotoPress(imageIndex);
    }
  };

  return (
    <TouchableOpacity
      onPress={uploaded !== false ? handlePress : undefined}
      activeOpacity={0.8}
      style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', position: 'relative' }}
    >
      {isVid ? (
        <View style={{ width: '100%', height: '100%', backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play-circle" size={size * 0.45} color="rgba(255,255,255,0.85)" />
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700', marginTop: 4 }}>VIDEO</Text>
        </View>
      ) : (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      )}

      {/* Upload progress overlay */}
      {uploaded === false && !error && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', marginTop: 3 }}>{progress}%</Text>
          <View style={{ width: '80%', height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, marginTop: 3 }}>
            <View style={{ width: `${progress}%`, height: 3, backgroundColor: '#fff', borderRadius: 2 }} />
          </View>
        </View>
      )}

      {/* Success tick */}
      {uploaded && !isVid && (
        <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: '#16a34a', borderRadius: 8, padding: 2 }}>
          <Ionicons name="checkmark" size={10} color="#fff" />
        </View>
      )}

      {/* Video: download badge */}
      {uploaded && isVid && (
        <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: 3, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Ionicons name="download-outline" size={10} color="#fff" />
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(220,38,38,0.75)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="alert-circle-outline" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 9, marginTop: 2 }}>Failed</Text>
        </View>
      )}

      {/* Remove button */}
      {showRemove && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}
          onPress={onRemove}
        >
          <Ionicons name="close" size={10} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Upload helper ────────────────────────────────────────────────────────────
async function uploadToCloudinary(uri, type = 'image', onProgress) {
  let finalUri = uri;
  let fileType = 'image/jpeg';
  let fileName = 'repair_image.jpg';

  if (type === 'image') {
    const compressed = await ImageManipulator.manipulateAsync(
      uri, [{ resize: { width: 1280 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );
    finalUri = compressed.uri;
  } else {
    fileType = 'video/mp4';
    fileName = 'repair_video.mp4';
  }

  const formData = new FormData();
  formData.append('file', { uri: finalUri, type: fileType, name: fileName });
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'repairs');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        console.log('Cloudinary error response:', xhr.responseText);
        reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, bg = TEAL }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.42 }}>{getInitial(name)}</Text>
    </View>
  );
}

function StatCard({ label, value, sub, valueColor, accent, t }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: t.border, borderTopWidth: 3, borderTopColor: accent, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
      <Text style={{ fontSize: 9, color: t.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 28, fontWeight: '900', lineHeight: 32, color: valueColor }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 10, color: t.muted, marginTop: 4, fontWeight: '500' }}>{sub}</Text> : null}
    </View>
  );
}

function FaultCard({ fault, onPress, t }) {
  const sevColor = SEV_COLOR[fault.severity] || '#aaa';
  const staColor = STA_COLOR[fault.status]   || '#aaa';
  const mediaFiles = fault.mediaFiles || [];
  const photoCount = mediaFiles.filter(m => m.type === 'image').length || (fault.imageUrls?.length || 0);
  const videoCount = mediaFiles.filter(m => m.type === 'video').length;

  return (
    <TouchableOpacity
      style={{ backgroundColor: t.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.border, borderLeftWidth: 4, borderLeftColor: sevColor, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}
      onPress={() => onPress(fault)} activeOpacity={0.82}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: t.text, flex: 1, marginRight: 8 }} numberOfLines={1}>{fault.machineName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, backgroundColor: staColor + '18', borderColor: staColor + '55' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: staColor }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: staColor }}>{fault.status}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: TEAL, fontWeight: '600', marginBottom: 2 }} numberOfLines={1}>{fault.title || '—'}</Text>
      <Text style={{ fontSize: 12, color: t.muted, marginBottom: 10 }} numberOfLines={1}>{fault.description}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: sevColor + '18' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: sevColor }}>{fault.severity}</Text>
        </View>
        <Text style={{ fontSize: 11, color: t.muted }}>{timeAgo(fault.createdAt)}</Text>
        {fault.repairNotes ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#7C3AED18', borderWidth: 1, borderColor: '#7C3AED33' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>Notes added</Text>
          </View>
        ) : null}
        {photoCount > 0 && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: TEAL + '18', borderWidth: 1, borderColor: TEAL + '33' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: TEAL }}>📷 {photoCount}</Text>
          </View>
        )}
        {videoCount > 0 && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#7C3AED18', borderWidth: 1, borderColor: '#7C3AED33' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>🎥 {videoCount}</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 4 }}>
        <Text style={{ fontSize: 11, color: t.muted }}>Tap to update</Text>
        <Ionicons name="chevron-forward" size={12} color={t.muted} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Fault Detail Modal ───────────────────────────────────────────────────────
function FaultDetailModal({ fault, visible, onClose, t }) {
  const [status, setStatus]           = useState('');
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [repairMedia, setRepairMedia] = useState([]);

  // image viewer state
  const [viewerVisible, setViewerVisible]   = useState(false);
  const [viewerImages, setViewerImages]     = useState([]);
  const [viewerStartIdx, setViewerStartIdx] = useState(0);

  const openViewer = (images, idx) => {
    setViewerImages(images);
    setViewerStartIdx(idx);
    setViewerVisible(true);
  };

  useEffect(() => {
    if (fault) {
      setStatus(fault.status || 'Reported');
      setNotes(fault.repairNotes || '');
      const existing = (fault.repairImageUrls || []).map((url, i) => ({
        id: `existing-${i}`, uri: url, type: 'image',
        progress: 100, uploaded: true, url, error: null,
      }));
      setRepairMedia(existing);
    }
  }, [fault]);

  const requestPermission = async (type) => {
    const { status } = type === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', `${type === 'camera' ? 'Camera' : 'Gallery'} access is required.`);
      return false;
    }
    return true;
  };

  const addAndUpload = async (uri, type = 'image') => {
    if (repairMedia.filter(f => f.type === 'image').length >= MAX_REPAIR_IMAGES && type === 'image') {
      Alert.alert('Limit Reached', `Max ${MAX_REPAIR_IMAGES} repair photos per fault.`);
      return;
    }
    const id    = Date.now().toString();
    const entry = { id, uri, type, progress: 0, uploaded: false, url: null, error: null };
    setRepairMedia(prev => [...prev, entry]);

    try {
      const url = await uploadToCloudinary(uri, type, (progress) => {
        setRepairMedia(prev => prev.map(f => f.id === id ? { ...f, progress } : f));
      });
      setRepairMedia(prev => prev.map(f => f.id === id ? { ...f, uploaded: true, url, progress: 100 } : f));
    } catch (err) {
      console.log('Repair upload error:', err);
      Alert.alert('Upload Failed', `Could not upload media. Please check your connection and try again.\n\nError: ${err.message}`);
      setRepairMedia(prev => prev.map(f => f.id === id ? { ...f, error: 'Failed' } : f));
    }
  };

  const handleCamera = async () => {
    if (!await requestPermission('camera')) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.canceled) addAndUpload(result.assets[0].uri, 'image');
  };

  const handleGallery = async () => {
    if (!await requestPermission('gallery')) return;
    const remaining = MAX_REPAIR_IMAGES - repairMedia.filter(f => f.type === 'image').length;
    if (remaining <= 0) { Alert.alert('Limit Reached', `Max ${MAX_REPAIR_IMAGES} repair photos.`); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (!result.canceled) {
      result.assets.forEach(a => addAndUpload(a.uri, a.type === 'video' ? 'video' : 'image'));
    }
  };

  const removeMedia = (id) => setRepairMedia(prev => prev.filter(f => f.id !== id));

  const handleSave = async () => {
    if (!fault) return;
    const stillUploading = repairMedia.some(f => !f.uploaded && !f.error);
    if (stillUploading) { Alert.alert('Please Wait', 'Media is still uploading.'); return; }

    setSaving(true);
    try {
      const repairImageUrls = repairMedia.filter(f => f.uploaded && f.url && f.type === 'image').map(f => f.url);
      const repairVideoUrls = repairMedia.filter(f => f.uploaded && f.url && f.type === 'video').map(f => f.url);

      await updateDoc(doc(db, 'faults', fault.id), {
        status, repairNotes: notes.trim(),
        repairImageUrls, repairVideoUrls,
        updatedAt: serverTimestamp(),
        ...(status === 'Fixed' ? { fixedAt: serverTimestamp() } : {}),
      });
      Alert.alert('Updated', `Fault marked as "${status}".`);
      onClose();
    } catch (e) {
      console.log(e);
      Alert.alert('Error', 'Could not update. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!fault) return null;
  const sevColor = SEV_COLOR[fault.severity] || '#aaa';
  const staColor = STA_COLOR[fault.status]   || '#aaa';

  const reportedMedia = fault.mediaFiles?.length
    ? fault.mediaFiles
    : (fault.imageUrls || []).map(url => ({ url, type: 'image' }));

  const reportedImageUrls = reportedMedia.filter(m => m.type === 'image').map(m => m.url);
  const repairImageUrls = repairMedia.filter(f => f.uploaded && f.type === 'image').map(f => f.uri);

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' }}>

              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: t.text }}>Fault Details</Text>
                <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: t.input, alignItems: 'center', justifyContent: 'center' }} onPress={onClose}>
                  <Ionicons name="close" size={18} color={t.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* Fault info */}
                <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: t.border, borderLeftWidth: 4, borderLeftColor: sevColor }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: t.text, flex: 1, marginRight: 8 }} numberOfLines={1}>{fault.machineName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, backgroundColor: staColor + '18', borderColor: staColor + '55' }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: staColor }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: staColor }}>{fault.status}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 14, color: TEAL, fontWeight: '700', marginBottom: 6 }}>{fault.title || '—'}</Text>
                  <Text style={{ fontSize: 13, color: t.subtext, lineHeight: 20, marginBottom: 10 }}>{fault.description}</Text>

                  {reportedMedia.length > 0 && (
                    <View style={{ marginTop: 6, marginBottom: 8 }}>
                      <Text style={{ fontSize: 10, color: t.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>REPORTED MEDIA</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {reportedMedia.map((m, i) => {
                            const isVid = m.type === 'video' || isVideoUrl(m.url);
                            const photoIdx = reportedImageUrls.indexOf(m.url);
                            return (
                              <MediaThumb
                                key={i}
                                uri={m.url}
                                type={isVid ? 'video' : 'image'}
                                uploaded={true}
                                size={70}
                                onPhotoPress={() => openViewer(reportedImageUrls, photoIdx)}
                              />
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: sevColor + '18' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: sevColor }}>{fault.severity}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: t.muted }}>Reported {timeAgo(fault.createdAt)}</Text>
                  </View>

                  {fault.repairNotes ? (
                    <View style={{ marginTop: 12, backgroundColor: '#7C3AED12', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#7C3AED33' }}>
                      <Text style={{ fontSize: 10, color: '#7C3AED', fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>PREVIOUS NOTES</Text>
                      <Text style={{ fontSize: 12, color: t.subtext, lineHeight: 18 }}>{fault.repairNotes}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Status */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, marginBottom: 10 }}>UPDATE STATUS</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {STATUS_OPTIONS.map(s => {
                    const sc = STA_COLOR[s];
                    const isActive = status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: isActive ? sc : t.border, backgroundColor: isActive ? sc + '18' : t.input }}
                        onPress={() => setStatus(s)}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sc }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? sc : t.muted }}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Notes */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, marginBottom: 10 }}>REPAIR NOTES</Text>
                <TextInput
                  style={{ backgroundColor: t.input, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: t.text, fontSize: 14, minHeight: 100, borderWidth: 1, borderColor: t.border, marginBottom: 4, textAlignVertical: 'top' }}
                  placeholder="Describe what was done, parts replaced..."
                  placeholderTextColor={t.muted}
                  value={notes} onChangeText={setNotes} multiline maxLength={600}
                />
                <Text style={{ color: t.muted, fontSize: 11, textAlign: 'right', marginBottom: 20 }}>{notes.length}/600</Text>

                {/* Repair media */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5 }}>REPAIR MEDIA</Text>
                  <View style={{ backgroundColor: TEAL + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: TEAL + '33' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: TEAL }}>{repairMedia.length}/{MAX_REPAIR_IMAGES}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  {[
                    { icon: 'camera-outline', label: 'Camera',  onPress: handleCamera  },
                    { icon: 'images-outline', label: 'Gallery', onPress: handleGallery },
                  ].map(btn => (
                    <TouchableOpacity
                      key={btn.label}
                      style={{ flex: 1, backgroundColor: t.input, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: t.border, gap: 6 }}
                      onPress={btn.onPress} activeOpacity={0.7}
                    >
                      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: TEAL + '18', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={btn.icon} size={20} color={TEAL} />
                      </View>
                      <Text style={{ color: t.subtext, fontSize: 12, fontWeight: '600' }}>{btn.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {repairMedia.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    {repairMedia.map((file, i) => {
                      const imgIdx = repairImageUrls.indexOf(file.uri);
                      return (
                        <MediaThumb
                          key={file.id}
                          uri={file.uri}
                          type={file.type}
                          progress={file.progress}
                          uploaded={file.uploaded}
                          error={file.error}
                          size={72}
                          showRemove
                          onRemove={() => removeMedia(file.id)}
                          onPhotoPress={() => openViewer(repairImageUrls, imgIdx)}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ backgroundColor: t.input, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, borderWidth: 1, borderColor: t.border }}>
                    <Ionicons name="cloud-upload-outline" size={16} color={t.muted} />
                    <Text style={{ fontSize: 12, color: t.muted, flex: 1, lineHeight: 18 }}>
                      Attach repair photos/videos. Photos are viewable, videos open for download.
                    </Text>
                  </View>
                )}

                {/* Mark Fixed shortcut */}
                {fault.status !== 'Fixed' && (
                  <TouchableOpacity
                    style={{ backgroundColor: '#16a34a18', borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#16a34a44', marginBottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    onPress={() => setStatus('Fixed')}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
                    <Text style={{ color: '#16a34a', fontSize: 14, fontWeight: '700' }}>Mark as Fixed</Text>
                  </TouchableOpacity>
                )}

                {/* Save */}
                <TouchableOpacity
                  style={{ backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 8, opacity: saving ? 0.5 : 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  onPress={handleSave} disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="save-outline" size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 }}>Save Changes</Text>
                      </>
                  }
                </TouchableOpacity>

              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ImageViewerModal
        visible={viewerVisible}
        images={viewerImages}
        startIndex={viewerStartIdx}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ user, userData, stats, onLogout, isDark, onToggleTheme, t }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: t.card, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: t.border }}>
        <Avatar name={userData?.name || ''} size={80} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: t.text, marginTop: 14, marginBottom: 6 }}>{userData?.name || '—'}</Text>
        <View style={{ backgroundColor: TEAL + '18', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: TEAL + '44', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="cog" size={12} color={TEAL} />
          <Text style={{ color: TEAL, fontSize: 12, fontWeight: '700' }}>Technician</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Assigned',  value: stats.total,     color: YELLOW,    accent: YELLOW    },
          { label: 'Repairing', value: stats.repairing, color: '#D97706', accent: '#D97706' },
          { label: 'Fixed',     value: stats.fixed,     color: '#16a34a', accent: TEAL      },
        ].map(s => (
          <View key={s.label} style={{ flex: 1, backgroundColor: t.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: t.border, borderTopWidth: 3, borderTopColor: s.accent }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: s.color }}>{s.value}</Text>
            <Text style={{ fontSize: 9, color: t.muted, fontWeight: '700', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, marginBottom: 16, overflow: 'hidden' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>ACCOUNT DETAILS</Text>
        {[
          { icon: 'mail-outline', label: 'Email', value: user?.email || '—' },
          { icon: 'call-outline',  label: 'Phone', value: userData?.phone || 'Not provided' },
        ].map((row, i) => (
          <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: t.border }}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: TEAL + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={row.icon} size={18} color={TEAL} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: t.muted, fontWeight: '600', marginBottom: 2 }}>{row.label}</Text>
              <Text style={{ fontSize: 14, color: t.text, fontWeight: '600' }}>{row.value}</Text>
            </View>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1, borderTopColor: t.border }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: YELLOW + '22', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={YELLOW} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: t.muted, fontWeight: '600', marginBottom: 2 }}>Total Faults Assigned</Text>
            <Text style={{ fontSize: 22, color: YELLOW, fontWeight: '900' }}>{stats.total}</Text>
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, marginBottom: 16, overflow: 'hidden' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1.5, padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>SETTINGS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: isDark ? '#334155' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={isDark ? '#94A3B8' : YELLOW} />
            </View>
            <View>
              <Text style={{ fontSize: 14, color: t.text, fontWeight: '600' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
              <Text style={{ fontSize: 11, color: t.muted }}>Switch appearance</Text>
            </View>
          </View>
          <Switch value={isDark} onValueChange={onToggleTheme} trackColor={{ false: '#CBD5E0', true: TEAL + '88' }} thumbColor={isDark ? TEAL : '#94A3B8'} />
        </View>
      </View>

      <TouchableOpacity
        style={{ backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
        onPress={onLogout}
      >
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text style={{ color: '#DC2626', fontSize: 14, fontWeight: '700' }}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TechnicianDashboard({ navigation }) {
  const [isDark, setIsDark]               = useState(false);
  const [activeTab, setActiveTab]         = useState('home');
  const [userData, setUserData]           = useState(null);
  const [faults, setFaults]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [filterStatus, setFilterStatus]   = useState('All');
  const [selectedFault, setSelectedFault] = useState(null);
  const [showDetail, setShowDetail]       = useState(false);

  const t    = isDark ? DARK : LIGHT;
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid))
      .then(s => { if (s.exists()) setUserData(s.data()); })
      .catch(e => console.log(e));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'faults'), where('assignedTechnicianId', '==', user.uid));
    return onSnapshot(q,
      snap => {
        setFaults(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)));
        setLoading(false); setRefreshing(false);
      },
      err => { console.log(err); setLoading(false); setRefreshing(false); }
    );
  }, [user]);

  const total     = faults.length;
  const repairing = faults.filter(f => f.status === 'Repairing').length;
  const fixed     = faults.filter(f => f.status === 'Fixed').length;
  const pending   = faults.filter(f => f.status === 'Reported').length;

  const FILTERS  = ['All', 'Reported', 'Repairing', 'Fixed'];
  const filtered = filterStatus === 'All' ? faults : faults.filter(f => f.status === filterStatus);

  const handleLogout = () => Alert.alert('Sign Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: async () => {
      try { await signOut(auth); navigation.replace('Login'); }
      catch { Alert.alert('Error', 'Could not sign out.'); }
    }},
  ]);

  const TABS = [
    { id: 'home',    icon: 'grid-outline',   label: 'My Faults' },
    { id: 'profile', icon: 'person-outline', label: 'Profile'   },
  ];

  const firstName = (userData?.name || '').split(' ')[0].substring(0, 14);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.headerBg} translucent={false} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: Platform.OS === 'android' ? 44 : 12, backgroundColor: t.headerBg, borderBottomWidth: 1, borderBottomColor: t.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: YELLOW, letterSpacing: 2 }}>MECH</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: TEAL, letterSpacing: 2 }}>TEK</Text>
        </View>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.input, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border }} onPress={() => setActiveTab('profile')}>
          <Avatar name={userData?.name || ''} size={24} />
          <Text style={{ color: t.subtext, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>Tech · {firstName}</Text>
          <Ionicons name="chevron-down" size={12} color={t.muted} />
        </TouchableOpacity>
      </View>

      {activeTab === 'profile' ? (
        <ProfileTab user={user} userData={userData} stats={{ total, repairing, fixed }} onLogout={handleLogout} isDark={isDark} onToggleTheme={() => setIsDark(p => !p)} t={t} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor={TEAL} />}>

          <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 2, marginBottom: 14 }}>MY ASSIGNMENTS</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <StatCard label="Total"   value={total}     sub="assigned"  valueColor={YELLOW}   accent={YELLOW}   t={t} />
            <StatCard label="Pending" value={pending}   sub="to start"  valueColor="#2563EB"  accent="#2563EB"  t={t} />
            <StatCard label="Active"  value={repairing} sub="repairing" valueColor="#D97706"  accent="#D97706"  t={t} />
            <StatCard label="Done"    value={fixed}     sub="fixed"     valueColor="#16a34a"  accent={TEAL}     t={t} />
          </View>

          {pending > 0 && (
            <View style={{ backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 14 }}>
              <MaterialCommunityIcons name="wrench" size={18} color="#2563EB" />
              <Text style={{ color: '#1D4ED8', fontSize: 13, fontWeight: '600', flex: 1 }}>
                {pending} fault{pending > 1 ? 's' : ''} waiting to be started
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: filterStatus === f ? TEAL + '18' : t.input, borderWidth: 1, borderColor: filterStatus === f ? TEAL : t.border }}
                onPress={() => setFilterStatus(f)}
              >
                <Text style={{ color: filterStatus === f ? TEAL : t.muted, fontSize: 12, fontWeight: '700' }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 2, marginBottom: 12 }}>
            {filterStatus === 'All' ? 'ALL ASSIGNED FAULTS' : `${filterStatus.toUpperCase()} FAULTS`}{' '}
            <Text style={{ color: t.muted }}>({filtered.length})</Text>
          </Text>

          {loading ? (
            <ActivityIndicator color={TEAL} size="large" style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <MaterialCommunityIcons name="wrench" size={52} color={t.muted} />
              <Text style={{ fontSize: 16, color: t.muted, fontWeight: '600', marginTop: 14 }}>
                {filterStatus === 'All' ? 'No faults assigned yet' : `No ${filterStatus.toLowerCase()} faults`}
              </Text>
              <Text style={{ fontSize: 13, color: t.muted, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }}>
                {filterStatus === 'All' ? 'Your supervisor will assign faults here' : 'Switch filter to see others'}
              </Text>
            </View>
          ) : (
            filtered.map(fault => (
              <FaultCard key={fault.id} fault={fault} onPress={f => { setSelectedFault(f); setShowDetail(true); }} t={t} />
            ))
          )}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.border, paddingBottom: Platform.OS === 'ios' ? 20 : 40, paddingTop: 8 }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }} onPress={() => setActiveTab(tab.id)}>
              <Ionicons name={tab.icon} size={22} color={active ? TEAL : t.muted} />
              <Text style={{ fontSize: 10, color: active ? TEAL : t.muted, marginTop: 3, fontWeight: active ? '700' : '500' }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FaultDetailModal visible={showDetail} fault={selectedFault} onClose={() => { setShowDetail(false); setSelectedFault(null); }} t={t} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});
