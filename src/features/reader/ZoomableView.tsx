import { useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  width: number;
  height: number;
  children: ReactNode;
  /** x do toque como fração da largura (0 a 1) */
  onTap: (xFraction: number) => void;
  onZoomChange: (zoomed: boolean) => void;
};

/** Pinça, arrasto (só com zoom), toque duplo e toque simples sobre qualquer conteúdo. */
export function ZoomableView({ width, height, children, onTap, onZoomChange }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const notify = (z: boolean) => {
    setZoomed(z);
    onZoomChange(z);
  };

  const reset = () => {
    'worklet';
    scale.set(withTiming(1));
    savedScale.set(1);
    tx.set(withTiming(0));
    ty.set(withTiming(0));
    savedTx.set(0);
    savedTy.set(0);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.set(scale.get());
    })
    .onUpdate((e) => {
      scale.set(Math.min(MAX_SCALE, Math.max(0.8, savedScale.get() * e.scale)));
    })
    .onEnd(() => {
      if (scale.get() < 1.05) {
        reset();
        scheduleOnRN(notify, false);
      } else {
        savedScale.set(scale.get());
        scheduleOnRN(notify, true);
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onStart(() => {
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    })
    .onUpdate((e) => {
      const maxX = (width * (scale.get() - 1)) / 2;
      const maxY = (height * (scale.get() - 1)) / 2;
      tx.set(Math.min(maxX, Math.max(-maxX, savedTx.get() + e.translationX)));
      ty.set(Math.min(maxY, Math.max(-maxY, savedTy.get() + e.translationY)));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_e, success) => {
      if (!success) return;
      if (scale.get() > 1.05) {
        reset();
        scheduleOnRN(notify, false);
      } else {
        scale.set(withTiming(DOUBLE_TAP_SCALE));
        savedScale.set(DOUBLE_TAP_SCALE);
        scheduleOnRN(notify, true);
      }
    });

  const singleTap = Gesture.Tap().onEnd((e, success) => {
    if (success) scheduleOnRN(onTap, e.x / width);
  });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.fill, { width, height }, style]} collapsable={false}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { overflow: 'hidden' },
});
