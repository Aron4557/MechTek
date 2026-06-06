import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

const YELLOW = '#F5A623';
const TEAL   = '#0D7377';
const BG     = '#F8FAFC';
const CARD   = '#FFFFFF';
const INPUT  = '#F1F5F9';
const BORDER = '#E2E8F0';
const TEXT   = '#0F172A';
const MUTED  = '#64748B';

const ROLES = [
  { id: 'Worker',     label: 'Worker',     icon: 'wrench'         },
  { id: 'Technician', label: 'Technician', icon: 'cog'            },
  { id: 'Supervisor', label: 'Supervisor', icon: 'shield-account' },
];

export default function LoginScreen({ navigation }) {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Worker');
  const [loading, setLoading]           = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) {
        Alert.alert('Error', 'User profile not found. Please register again.');
        setLoading(false); return;
      }
      const role = snap.data().role;
      if (selectedRole !== role) {
        Alert.alert('Login Failed', 'Invalid email, password, or role combination.');
        setLoading(false); return;
      }
      if (role === 'Worker')          navigation.replace('WorkerDashboard');
      else if (role === 'Technician') navigation.replace('TechnicianDashboard');
      else if (role === 'Supervisor') navigation.replace('SupervisorDashboard');
    } catch (err) {
      let msg = 'Login failed. Please try again.';
      if (err.code === 'auth/user-not-found')              msg = 'No account found with this email.';
      else if (err.code === 'auth/wrong-password')         msg = 'Incorrect password.';
      else if (err.code === 'auth/invalid-credential')     msg = 'Invalid email or password.';
      else if (err.code === 'auth/invalid-email')          msg = 'Invalid email format.';
      else if (err.code === 'auth/too-many-requests')      msg = 'Too many attempts. Try again later.';
      else if (err.code === 'auth/network-request-failed') msg = 'Network error. Check connection.';
      Alert.alert('Login Failed', msg);
    } finally { setLoading(false); }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Type your email address above first, then tap Forgot Password.');
      return;
    }
    Alert.alert(
      'Reset Password',
      `Send a reset link to ${email.trim()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              const q = query(
                collection(db, 'users'),
                where('email', '==', email.trim().toLowerCase())
              );
              const snap = await getDocs(q);
              if (snap.empty) {
                Alert.alert('Not Found', 'No account found with this email address.');
                return;
              }
              await sendPasswordResetEmail(auth, email.trim());
              Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
            } catch (err) {
              let msg = 'Could not send reset email. Please try again.';
              if (err.code === 'auth/invalid-email') msg = 'Invalid email format.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >

        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.brandLogoRow}>
            <Text style={styles.brandMech}>MECH</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandTek}>TEK</Text>
          </View>
          <Text style={styles.brandSub}>Maintenance Management System</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSub}>Enter your credentials to continue</Text>

          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="you@company.com"
              placeholderTextColor={MUTED}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor={MUTED}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={MUTED} />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Role */}
          <Text style={styles.label}>Select Your Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map(r => {
              const active = selectedRole === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                  onPress={() => setSelectedRole(r.id)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name={r.icon} size={24} color={active ? TEAL : MUTED} />
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Submit */}
          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>SIGN IN</Text>
            }
          </TouchableOpacity>

          {/* Link */}
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Don't have an account? </Text>
            <Text style={styles.linkBold}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 48 : 48,
    paddingBottom: 32,
  },

  brand:        { alignItems: 'center', marginBottom: 36 },
  brandLogoRow: { flexDirection: 'row', alignItems: 'center' },
  brandMech:    { fontSize: 40, fontWeight: '900', color: YELLOW, letterSpacing: 4 },
  brandDivider: { width: 2, height: 38, backgroundColor: BORDER, marginHorizontal: 8, borderRadius: 1 },
  brandTek:     { fontSize: 40, fontWeight: '900', color: TEAL, letterSpacing: 4 },
  brandSub:     { fontSize: 12, color: MUTED, marginTop: 8, letterSpacing: 0.5 },

  card: {
    backgroundColor: CARD, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
    borderWidth: 1, borderColor: BORDER,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 4 },
  cardSub:   { fontSize: 13, color: MUTED, marginBottom: 24 },

  label: { fontSize: 12, fontWeight: '700', color: TEXT, marginBottom: 8, marginTop: 14, letterSpacing: 0.3 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: INPUT, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input:     { flex: 1, paddingVertical: 13, fontSize: 14, color: TEXT },
  eyeBtn:    { padding: 4 },

  forgotBtn:  { alignSelf: 'flex-end', marginTop: 8 },
  forgotText: { color: TEAL, fontSize: 12, fontWeight: '700' },

  roleRow:        { flexDirection: 'row', gap: 10, marginBottom: 8 },
  roleCard:       { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: INPUT, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: BORDER },
  roleCardActive: { borderColor: TEAL, backgroundColor: TEAL + '12' },
  roleLabel:      { fontSize: 11, fontWeight: '700', color: MUTED },
  roleLabelActive:{ color: TEAL },

  btn:     { backgroundColor: TEAL, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20, marginBottom: 16 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1.5 },

  linkRow: { flexDirection: 'row', justifyContent: 'center' },
  linkText:{ color: MUTED, fontSize: 13 },
  linkBold:{ color: TEAL, fontSize: 13, fontWeight: '700' },
});