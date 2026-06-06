
// splash screen //

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, StatusBar, Platform,
} from 'react-native';

const YELLOW = '#F5C518';
const TEAL   = '#00BFA5';
const DARK   = '#1A1A2E';

const LETTERS = ['M', 'E', 'C', 'H', 'T', 'E', 'K'];

const MESSAGES = [
  'Please be patient while we keep things together…',
  'Hold on, we are almost there…',
  'Warming up the engines…',
  'Almost ready for you…',
];

export default function SplashScreen({ navigation }) {
  const [visibleCount, setVisibleCount]   = useState(0);
  const [msgIndex, setMsgIndex]           = useState(0);
  const [msgVisible, setMsgVisible]       = useState(false);

  // One Animated.Value per letter for opacity + translateY
  const letterAnims = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const msgOpacity  = useRef(new Animated.Value(0)).current;
  const spinAnim    = useRef(new Animated.Value(0)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ── 1. Animate letters one by one ──
    const letterSequence = LETTERS.map((_, i) =>
      Animated.timing(letterAnims[i], {
        toValue: 1,
        duration: 180,
        delay: i * 160,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      })
    );

    Animated.stagger(160, letterSequence).start(() => {
      // ── 2. Glow pulse after all letters appear ──
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();

      // ── 3. Show first message ──
      setMsgVisible(true);
      Animated.timing(msgOpacity, {
        toValue: 1, duration: 500, useNativeDriver: true,
      }).start();
    });

    // ── 4. Cycle loading messages ──
    const msgTimer = setInterval(() => {
      Animated.timing(msgOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setMsgIndex(prev => (prev + 1) % MESSAGES.length);
        Animated.timing(msgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2800);

    // ── 5. Rotating spinner ──
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // ── 6. Navigate after 5s ──
    const navTimer = setTimeout(() => {
      navigation.replace('Login');
    }, 5000);

    return () => {
      clearInterval(msgTimer);
      clearTimeout(navTimer);
    };
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={DARK} translucent={false} />

      {/* Background grid lines for industrial feel */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {[...Array(8)].map((_, i) => (
          <View key={i} style={[styles.gridLine, { top: `${i * 14}%` }]} />
        ))}
      </View>

      {/* Corner accents */}
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerBR]} />

      {/* ── Letters ── */}
      <View style={styles.lettersRow}>
        {LETTERS.map((letter, i) => {
          const opacity = letterAnims[i];
          const translateY = letterAnims[i].interpolate({
            inputRange: [0, 1], outputRange: [40, 0],
          });
          const scale = letterAnims[i].interpolate({
            inputRange: [0, 1], outputRange: [0.4, 1],
          });

          // The dot between MECH and TEK
          const showDot = i === 4;

          return (
            <React.Fragment key={i}>
              {showDot && (
                <Animated.View style={[styles.dotSeparator, { opacity: letterAnims[3] }]}>
                  <View style={styles.dotSeparatorDot} />
                </Animated.View>
              )}
              <Animated.Text
                style={[
                  styles.letter,
                  i >= 4 ? styles.letterTeal : styles.letterYellow,
                  { opacity, transform: [{ translateY }, { scale }] },
                ]}
              >
                {letter}
              </Animated.Text>
            </React.Fragment>
          );
        })}
      </View>

      {/* Glow underline */}
      <Animated.View style={[styles.underline, { opacity: glowOpacity }]} />

      {/* Subtitle */}
      <Animated.Text style={[styles.subtitle, { opacity: letterAnims[6] }]}>
        Maintenance Management System
      </Animated.Text>

      {/* Loading message */}
      <View style={styles.messageContainer}>
        <Animated.Text style={[styles.message, { opacity: msgOpacity }]}>
          {MESSAGES[msgIndex]}
        </Animated.Text>
      </View>

      {/* Animated loading bar */}
      <View style={styles.loaderTrack}>
        <Animated.View
          style={[
            styles.loaderFill,
            {
              opacity: glowAnim.interpolate({
                inputRange: [0, 1], outputRange: [0.4, 1],
              }),
              transform: [{
                scaleX: glowAnim.interpolate({
                  inputRange: [0, 1], outputRange: [0.2, 0.85],
                }),
              }],
            },
          ]}
        />
      </View>

      {/* Rotating loading button */}
      <View style={styles.loadingBtn}>
        <Animated.View style={{
          transform: [{
            rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
          }]
        }}>
          <View style={styles.spinner}>
            <View style={styles.spinnerArc} />
          </View>
        </Animated.View>
        <Text style={styles.loadingBtnText}>LOADING</Text>
      </View>

      {/* Version */}
      <Text style={styles.version}>v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },

  // Background grid
  gridOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.04 },
  gridLine: {
    position: 'absolute', left: 0, right: 0,
    height: 1, backgroundColor: '#ffffff',
  },

  // Corner accents
  corner: {
    position: 'absolute', width: 40, height: 40,
    borderColor: TEAL, opacity: 0.4,
  },
  cornerTL: { top: 40, left: 24, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: 60, right: 24, borderBottomWidth: 2, borderRightWidth: 2 },

  // Letters row
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  letter: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 2,
  },
  letterYellow: { color: YELLOW },
  letterTeal:   { color: TEAL },

  dotSeparator: {
    width: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  dotSeparatorDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff33',
  },

  // Glow underline
  underline: {
    width: 200, height: 2, borderRadius: 2,
    backgroundColor: YELLOW,
    marginBottom: 14,
    shadowColor: YELLOW,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },

  subtitle: {
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 60,
  },

  // Message
  messageContainer: { height: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  message: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Loader bar
  loaderTrack: {
    marginTop: 24,
    width: 180, height: 3,
    backgroundColor: '#ffffff10',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loaderFill: {
    height: '100%',
    width: '100%',
    backgroundColor: TEAL,
    borderRadius: 2,
    transformOrigin: 'left',
  },

  // Loading button with spinner
  loadingBtn: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16213E',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#ffffff12',
  },
  loadingBtnText: {
    fontSize: 12, color: '#475569', fontWeight: '700', letterSpacing: 2,
  },
  spinner: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#ffffff15',
    borderTopColor: YELLOW,
    borderRightColor: TEAL,
  },

  version: {
    position: 'absolute',
    bottom: 16,
    fontSize: 11,
    color: '#1e3a5f',
    fontWeight: '600',
    letterSpacing: 1,
  },
});
