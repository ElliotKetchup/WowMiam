/** Shared building blocks: brutal pressables, chips, text presets, stickers. */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, Text, type TextProps, View, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe } from 'react-native-reanimated';

import { C, F, hardShadow } from '@/lib/theme';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

export function Icon({ name, size = 22, color = C.ink }: { name: IconName; size?: number; color?: string }) {
  return <MaterialIcons name={name} size={size} color={color} />;
}

type TxtProps = TextProps & { size?: number; color?: string; font?: keyof typeof F };

export function Txt({ size = 15, color = C.ink, font = 'body', style, ...rest }: TxtProps) {
  return <Text {...rest} style={[{ fontFamily: F[font], fontSize: size, color, lineHeight: Math.round(size * 1.35) }, style]} />;
}

export function Display({ size = 24, color = C.ink, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: F.display, fontSize: size, color, lineHeight: Math.round(size * 1.02), letterSpacing: -size * 0.025 }, style]}
    />
  );
}

export const tap = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};

type BrutProps = Omit<PressableProps, 'style' | 'children'> & {
  color?: string;
  radius?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  haptic?: boolean;
  shadow?: string;
};

/** A neo-brutal surface: ink outline and hard shadow; pressing sinks it into the shadow. */
export function Brut({ color = C.tile, radius = 16, offset = 4, style, children, haptic = true, shadow = C.ink, onPress, ...rest }: BrutProps) {
  return (
    <Pressable
      {...rest}
      onPress={(e) => {
        if (haptic) tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          backgroundColor: color,
          borderRadius: radius,
          borderWidth: 2,
          borderColor: C.ink,
          boxShadow: pressed ? hardShadow(0, shadow) : hardShadow(offset, shadow),
          transform: pressed ? [{ translateX: offset }, { translateY: offset }] : [],
        },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

/** Same look as Brut, without press behaviour. */
type BrutBoxProps = { color?: string; radius?: number; offset?: number; style?: StyleProp<ViewStyle>; children?: ReactNode };

export function BrutBox({ color = C.tile, radius = 16, offset = 4, style, children }: BrutBoxProps) {
  return (
    <View style={[{ backgroundColor: color, borderRadius: radius, borderWidth: 2, borderColor: C.ink, boxShadow: hardShadow(offset) }, style]}>
      {children}
    </View>
  );
}

type ChipProps = {
  label: string;
  color?: string;
  textColor?: string;
  icon?: IconName;
  trailing?: IconName;
  onPress?: () => void;
  big?: boolean;
  outline?: string;
};

export function Chip({ label, color = C.tile, textColor = C.ink, icon, trailing, onPress, big = false, outline }: ChipProps) {
  const body = (pressed: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        maxWidth: '100%',
        height: big ? 38 : 28,
        paddingHorizontal: big ? 14 : 10,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: outline ?? C.ink,
        backgroundColor: color,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      }}>
      {icon ? <Icon name={icon} size={big ? 18 : 15} color={textColor} /> : null}
      <Txt font="semi" size={big ? 14 : 13} color={textColor} style={{ lineHeight: big ? 18 : 16, flexShrink: 1 }} numberOfLines={1}>
        {label}
      </Txt>
      {trailing ? <Icon name={trailing} size={15} color={textColor} /> : null}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={() => { tap(); onPress(); }} hitSlop={6} style={{ maxWidth: '100%' }}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/**
 * Motion vocabulary. Only two things bounce in the app, and barely:
 * tiles and folders `popIn`; stickers are applied like real stickers (see components/sticker.tsx).
 * Everything else fades or slides on a plain timing curve.
 */
export const popIn = (delay = 0) =>
  // Reanimated's web runtime pins in-flow Keyframe targets to `position: absolute` once they finish; plain fade there.
  Platform.OS === 'web'
    ? FadeIn.duration(260).delay(delay)
    : new Keyframe({
        0: { opacity: 0, transform: [{ scale: 0.94 }] },
        65: { opacity: 1, transform: [{ scale: 1.012 }], easing: Easing.out(Easing.cubic) },
        100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.inOut(Easing.quad) },
      })
        .duration(380)
        .delay(delay);

/** Lands roughly when the tile it sits on has settled. */
export const STICKER_LAG = 300;

/**
 * Folder stickers come *out* of the pocket instead: they rise from behind the folder front while
 * swinging on an arc, as if turning on a wheel whose hub sits far below them.
 */
export const riseIn = (delay = 0, size = 100) => {
  const hub = size * 1.4; // distance from the sticker centre down to the arc's pivot
  const at = (deg: number, lift: number) => {
    const rad = (deg * Math.PI) / 180;
    return [{ translateX: hub * Math.sin(rad) }, { translateY: lift + hub * (1 - Math.cos(rad)) }, { rotate: `${deg}deg` }];
  };
  return new Keyframe({
    0: { transform: at(-28, size * 1.05) },
    35: { transform: at(-12, size * 0.45), easing: Easing.out(Easing.quad) },
    72: { transform: at(3, -size * 0.03), easing: Easing.out(Easing.cubic) },
    100: { transform: at(0, 0), easing: Easing.inOut(Easing.quad) },
  })
    .duration(620)
    .delay(delay);
};

/** The "Enregistré !" stamp: same press-flat landing as a sticker. */
export const stampIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.7 }, { rotate: '-2deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '-8deg' }], easing: Easing.in(Easing.cubic) },
}).duration(260);

/** Paper band behind the status bar so scrolled content doesn't run under the clock. */
export function StatusShade({ height }: { height: number }) {
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height, backgroundColor: C.paper }} />;
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, borderWidth: 2, borderColor: C.ink, boxShadow: hardShadow(2), overflow: 'hidden' }}>
      <Image source={require('@/assets/brand/icon.png')} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
