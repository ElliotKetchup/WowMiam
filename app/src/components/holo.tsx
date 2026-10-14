/**
 * Phone tilt for the holographic stickers. One rotation sensor for the whole app; stickers read
 * how far the phone has moved from the way it is being held (a slowly following baseline), so the
 * foil shifts when you tilt it and settles when you hold still.
 */
import { createContext, type ReactNode, useContext } from 'react';
import { Platform } from 'react-native';
import {
  type SharedValue,
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

export type Tilt = { x: SharedValue<number>; y: SharedValue<number> };

const TiltContext = createContext<Tilt | null>(null);

const FOLLOW = 0.03; // how fast the baseline catches up with a new holding angle
const RANGE = 0.35; // radians of tilt that sweep the foil across its full range

const clamp = (v: number): number => {
  'worklet';
  return Math.max(-1, Math.min(1, v / RANGE));
};

function SensorTilt({ children }: { children: ReactNode }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const base = useSharedValue<{ roll: number; pitch: number } | null>(null);
  const rotation = useAnimatedSensor(SensorType.ROTATION, { interval: 33 });

  useAnimatedReaction(
    () => rotation.sensor.value,
    (r) => {
      const b = base.value ?? { roll: r.roll, pitch: r.pitch };
      const next = { roll: b.roll + (r.roll - b.roll) * FOLLOW, pitch: b.pitch + (r.pitch - b.pitch) * FOLLOW };
      base.value = next;
      x.value = clamp(r.roll - next.roll);
      y.value = clamp(r.pitch - next.pitch);
    },
  );

  return <TiltContext.Provider value={{ x, y }}>{children}</TiltContext.Provider>;
}

function StillTilt({ children }: { children: ReactNode }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  return <TiltContext.Provider value={{ x, y }}>{children}</TiltContext.Provider>;
}

export function HoloProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  if (Platform.OS === 'web' || reduced) return <StillTilt>{children}</StillTilt>;
  return <SensorTilt>{children}</SensorTilt>;
}

export function useTilt(): Tilt {
  const tilt = useContext(TiltContext);
  if (!tilt) throw new Error('useTilt must be used inside <HoloProvider>');
  return tilt;
}
