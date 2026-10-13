import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { CONFETTI_PIECES, type ConfettiPiece as Piece, makeConfettiPieces } from '@/utils/confetti';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const COLORS = ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#38bdf8', '#f472b6', '#a78bfa', '#fb923c'];

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
          left: piece.x * SCREEN_W,
          width: piece.size,
          height: piece.size * 1.4,
          backgroundColor: COLORS[piece.colorIndex % COLORS.length],
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

/** Full-screen confetti for workout completion, falling in waves (timing in utils/confetti). */
export function WorkoutConfetti({
  visible,
  pieceCount = CONFETTI_PIECES,
}: { visible: boolean; pieceCount?: number }) {
  const pieces = useMemo(() => (visible ? makeConfettiPieces(pieceCount) : []), [visible, pieceCount]);

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
