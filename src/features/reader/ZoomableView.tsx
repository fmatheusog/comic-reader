import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/** Limita o deslocamento para a imagem ampliada não deixar o quadro vazio. */
const clampOffset = (value: number, size: number, scale: number) => {
  'worklet';
  const max = Math.max(0, (size * (scale - 1)) / 2);
  return Math.min(max, Math.max(-max, value));
};

type Props = {
  width: number;
  height: number;
  children: ReactNode;
  /** x do toque como fração da largura (0 a 1) */
  onTap: (xFraction: number) => void;
  onZoomChange: (zoomed: boolean) => void;
};

/**
 * Pinça, arrasto (só com zoom), toque duplo e toque simples sobre qualquer conteúdo.
 * O zoom segue o ponto tocado: o conteúdo sob os dedos (ou sob o toque duplo) fica no lugar.
 * Os gestos ficam num View fixo, para as coordenadas não serem afetadas pela transformação.
 */
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

  // foco inicial da pinça, relativo ao centro da área
  const startFx = useSharedValue(0);
  const startFy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      savedScale.set(scale.get());
      savedTx.set(tx.get());
      savedTy.set(ty.get());
      startFx.set(e.focalX - width / 2);
      startFy.set(e.focalY - height / 2);
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_SCALE, Math.max(0.8, savedScale.get() * e.scale));
      const ratio = next / savedScale.get();
      // o ponto de conteúdo que estava sob o foco inicial acompanha o foco atual
      const fx = e.focalX - width / 2;
      const fy = e.focalY - height / 2;
      scale.set(next);
      tx.set(clampOffset(fx - ratio * (startFx.get() - savedTx.get()), width, next));
      ty.set(clampOffset(fy - ratio * (startFy.get() - savedTy.get()), height, next));
    })
    .onEnd(() => {
      if (scale.get() < 1.05) {
        reset();
        scheduleOnRN(notify, false);
      } else {
        savedScale.set(scale.get());
        savedTx.set(tx.get());
        savedTy.set(ty.get());
        scheduleOnRN(notify, true);
      }
    });

  // um dedo só: com dois, quem move a imagem é a pinça
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .maxPointers(1)
    .onStart(() => {
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    })
    .onUpdate((e) => {
      tx.set(clampOffset(savedTx.get() + e.translationX, width, scale.get()));
      ty.set(clampOffset(savedTy.get() + e.translationY, height, scale.get()));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e, success) => {
      if (!success) return;
      if (scale.get() > 1.05) {
        reset();
        scheduleOnRN(notify, false);
      } else {
        const fx = e.x - width / 2;
        const fy = e.y - height / 2;
        const ratio = DOUBLE_TAP_SCALE;
        const nx = clampOffset(fx - ratio * fx, width, DOUBLE_TAP_SCALE);
        const ny = clampOffset(fy - ratio * fy, height, DOUBLE_TAP_SCALE);
        scale.set(withTiming(DOUBLE_TAP_SCALE));
        tx.set(withTiming(nx));
        ty.set(withTiming(ny));
        savedScale.set(DOUBLE_TAP_SCALE);
        savedTx.set(nx);
        savedTy.set(ny);
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
      <View style={[styles.fill, { width, height }]} collapsable={false}>
        <Animated.View style={[styles.fill, { width, height }, style]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { overflow: 'hidden' },
});
