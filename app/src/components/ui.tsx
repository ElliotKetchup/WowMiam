/** Shared building blocks: brutal pressables, chips, text presets, stickers. */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, Text, type TextProps, View, type ViewStyle } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { type Recipe, STICKERS } from '@/lib/data';
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
        height: big ? 38 : 28,
        paddingHorizontal: big ? 14 : 10,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: outline ?? C.ink,
        backgroundColor: color,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      }}>
      {icon ? <Icon name={icon} size={big ? 18 : 15} color={textColor} /> : null}
      <Txt font="semi" size={big ? 14 : 13} color={textColor} style={{ lineHeight: big ? 18 : 16 }}>
        {label}
      </Txt>
      {trailing ? <Icon name={trailing} size={15} color={textColor} /> : null}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={() => { tap(); onPress(); }} hitSlop={6}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/** Sticker "slap": lands from above, squashes a hair, settles. */
export const slapIn = (delay = 0) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 1.4 }, { rotate: '10deg' }, { translateY: -14 }] },
    55: { opacity: 1, transform: [{ scale: 0.93 }, { rotate: '-1.5deg' }, { translateY: 0 }] },
    80: { opacity: 1, transform: [{ scale: 1.02 }, { rotate: '0deg' }, { translateY: 0 }] },
    100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }, { translateY: 0 }] },
  })
    .duration(520)
    .delay(delay);

type StickerProps = {
  recipe: Pick<Recipe, 'sticker' | 'photoUri' | 'name'>;
  size: number;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  animate?: boolean;
};

/** A dish sticker. Bundled cut-outs carry their own white die-cut edge; user photos become round stickers. */
export function Sticker({ recipe, size, rotate = 0, style, delay = 0, animate = true }: StickerProps) {
  let content: ReactNode;
  if (recipe.photoUri) {
    const d = size * 0.86;
    content = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: Math.max(4, d * 0.05), borderColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0px 6px 10px rgba(42,21,48,0.3)' }}>
          <Image source={{ uri: recipe.photoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </View>
      </View>
    );
  } else if (recipe.sticker) {
    content = <Image source={STICKERS[recipe.sticker]} style={{ width: '100%', height: '100%' }} contentFit="contain" />;
  } else {
    content = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.5)' }}>
          <Display size={size * 0.28}>{recipe.name.charAt(0).toUpperCase()}</Display>
        </View>
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <Animated.View entering={animate ? slapIn(delay) : undefined} style={{ flex: 1 }}>
        {content}
      </Animated.View>
    </View>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, borderWidth: 2, borderColor: C.ink, boxShadow: hardShadow(2), overflow: 'hidden' }}>
      <Image source={require('@/assets/brand/icon.png')} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
