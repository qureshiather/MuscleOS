import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const COLORS = ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#38bdf8', '#f472b6', '#a78bfa', '#fb923c'];

type Piece = {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
  spin: number;
};

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    left: Math.random() * SCREEN_W,
    delay: Math.floor(Math.random() * 280),
    duration: 1600 + Math.floor(Math.random() * 900),
    size: 6 + Math.floor(Math.random() * 8),
    color: COLORS[i % COLORS.length],
    drift: -60 + Math.random() * 120,
    spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
  }));
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: piece.duration,
      delay: piece.delay,
      useNativeDriver: true,
    }).start();
  }, [piece.delay, piece.duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, SCREEN_H * 0.85],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, piece.drift],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${piece.spin}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.75, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          left: piece.left,
          width: piece.size,
          height: piece.size * 1.4,
          backgroundColor: piece.color,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

/** Full-screen confetti burst for workout completion. */
export function WorkoutConfetti({ visible, pieceCount = 48 }: { visible: boolean; pieceCount?: number }) {
  const pieces = useMemo(() => (visible ? makePieces(pieceCount) : []), [visible, pieceCount]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  piece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
});
