/**
 * Dish stickers. Bundled cut-outs carry their own white die-cut edge; user photos become round stickers.
 * They are applied like real stickers (held above the tile, laid down from one side, pressed flat) and
 * carry a holographic foil that shimmers with the phone's tilt, strong on the edge and faint on the dish.
 */
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { type ReactNode, useEffect } from 'react';
import { Image as RNImage, Platform, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, Keyframe, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useTilt } from '@/components/holo';
import { Display, riseIn } from '@/components/ui';
import { HOLO_MASKS, type Recipe, STICKERS } from '@/lib/data';
import { C } from '@/lib/theme';

const STICK_MS = 760;
/** Fraction of STICK_MS at which the sticker is pressed flat. */
const PRESSED_AT = 0.84;

const RAINBOW =
  'linear-gradient(115deg, #FFB3E1 0%, #FFF1A8 12%, #B5F5D8 24%, #A8DCFF 36%, #D7B8FF 48%, #FFB3E1 60%, #FFF1A8 72%, #B5F5D8 84%, #A8DCFF 100%)';
const GLINT = 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0) 100%)';

/** Held a little above the surface, tilted; one side touches down first, then it is smoothed flat. */
const stickIn = (delay: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ perspective: 700 }, { translateY: -26 }, { scale: 1.16 }, { rotateZ: '7deg' }, { rotateY: '-38deg' }] },
    22: { opacity: 1, transform: [{ perspective: 700 }, { translateY: -22 }, { scale: 1.15 }, { rotateZ: '6deg' }, { rotateY: '-34deg' }] },
    62: { opacity: 1, transform: [{ perspective: 700 }, { translateY: -6 }, { scale: 1.05 }, { rotateZ: '2deg' }, { rotateY: '-10deg' }], easing: Easing.inOut(Easing.quad) },
    84: { opacity: 1, transform: [{ perspective: 700 }, { translateY: 0 }, { scale: 1 }, { rotateZ: '0deg' }, { rotateY: '0deg' }], easing: Easing.out(Easing.cubic) },
    100: { opacity: 1, transform: [{ perspective: 700 }, { translateY: 0 }, { scale: 1 }, { rotateZ: '0deg' }, { rotateY: '0deg' }] },
  })
    .duration(STICK_MS)
    .delay(delay);

/** The shadow it casts while held above the surface; gone once it is flat. */
const liftShadowIn = (delay: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: 18 }, { translateY: 24 }, { scale: 1.12 }] },
    22: { opacity: 0.32, transform: [{ translateX: 16 }, { translateY: 22 }, { scale: 1.12 }] },
    62: { opacity: 0.2, transform: [{ translateX: 6 }, { translateY: 8 }, { scale: 1.04 }], easing: Easing.inOut(Easing.quad) },
    84: { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.cubic) },
    100: { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
  })
    .duration(STICK_MS)
    .delay(delay);

type Face = 'bundled' | 'photo' | 'placeholder';
type StickerRecipe = Pick<Recipe, 'sticker' | 'photoUri' | 'name'>;

type StickerProps = {
  recipe: StickerRecipe;
  size: number;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  animate?: boolean;
  /** `stick`: applied onto a tile. `rise`: pulled out of a folder pocket. */
  enter?: 'stick' | 'rise';
};

export function Sticker({ recipe, size, rotate = 0, style, delay = 0, animate = true, enter = 'stick' }: StickerProps) {
  const face: Face = recipe.photoUri ? 'photo' : recipe.sticker ? 'bundled' : 'placeholder';
  const entering = !animate ? undefined : enter === 'rise' ? riseIn(delay, size) : stickIn(delay);
  const landsAt = delay + (enter === 'rise' ? 450 : STICK_MS * PRESSED_AT);
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      {animate && enter === 'stick' && face !== 'placeholder' ? (
        <Animated.View entering={liftShadowIn(delay)} style={[StyleSheet.absoluteFill, { opacity: 0 }]}>
          <ShadowShape recipe={recipe} face={face} size={size} />
        </Animated.View>
      ) : null}
      <Animated.View entering={entering} style={{ flex: 1 }}>
        <FaceView recipe={recipe} face={face} size={size} />
        {face === 'placeholder' ? null : <Foil mask={<FoilMask recipe={recipe} face={face} size={size} />} size={size} landsAt={landsAt} sweep={animate} />}
      </Animated.View>
    </View>
  );
}

const photoDiameter = (size: number): number => size * 0.86;
const photoBorder = (d: number): number => Math.max(4, d * 0.05);

function FaceView({ recipe, face, size }: { recipe: StickerRecipe; face: Face; size: number }) {
  if (face === 'photo') {
    const d = photoDiameter(size);
    return (
      <View style={styles.center}>
        <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: photoBorder(d), borderColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0px 6px 10px rgba(42,21,48,0.3)' }}>
          <Image source={{ uri: recipe.photoUri }} style={styles.fill} contentFit="cover" />
        </View>
      </View>
    );
  }
  if (face === 'bundled' && recipe.sticker) {
    return <Image source={STICKERS[recipe.sticker]} style={styles.fill} contentFit="contain" />;
  }
  return (
    <View style={styles.center}>
      <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.5)' }}>
        <Display size={size * 0.28}>{recipe.name.charAt(0).toUpperCase()}</Display>
      </View>
    </View>
  );
}

function ShadowShape({ recipe, face, size }: { recipe: StickerRecipe; face: Face; size: number }) {
  if (face === 'bundled' && recipe.sticker) {
    return <Image source={STICKERS[recipe.sticker]} style={styles.fill} contentFit="contain" tintColor={C.ink} blurRadius={8} />;
  }
  const d = photoDiameter(size);
  return (
    <View style={styles.center}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: C.ink }} />
    </View>
  );
}

/** Where the foil shows: alpha 1 on the white edge, ~0.2 over the food. */
function FoilMask({ recipe, face, size }: { recipe: StickerRecipe; face: Face; size: number }) {
  if (face === 'bundled' && recipe.sticker) {
    return <RNImage source={HOLO_MASKS[recipe.sticker]} style={styles.fill} resizeMode="contain" />;
  }
  const d = photoDiameter(size);
  return (
    <View style={styles.center}>
      <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: photoBorder(d), borderColor: '#000000', backgroundColor: 'rgba(0,0,0,0.2)' }} />
    </View>
  );
}

function Foil({ mask, size, landsAt, sweep }: { mask: ReactNode; size: number; landsAt: number; sweep: boolean }) {
  const { x, y } = useTilt();
  const glintAt = useSharedValue(sweep ? -1 : 1.6);

  useEffect(() => {
    if (sweep) glintAt.value = withDelay(landsAt, withTiming(1.6, { duration: 700, easing: Easing.inOut(Easing.quad) }));
  }, [sweep, landsAt, glintAt]);

  const rainbow = useAnimatedStyle(() => ({
    transform: [{ translateX: -size + x.value * size * 0.9 }, { translateY: -size + y.value * size * 0.6 }],
  }));
  const glint = useAnimatedStyle(() => ({
    transform: [{ translateX: glintAt.value * size * 1.2 + x.value * size * 0.35 }, { rotate: '20deg' }],
  }));

  if (Platform.OS === 'web') return null; // the masked-view web build can't mask with an image
  return (
    <MaskedView pointerEvents="none" style={StyleSheet.absoluteFill} maskElement={<View style={styles.fill}>{mask}</View>}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size * 3, height: size * 3, opacity: 0.9, experimental_backgroundImage: RAINBOW }, rainbow]} />
      <Animated.View style={[{ position: 'absolute', left: -size * 0.25, top: -size * 0.5, width: size * 0.45, height: size * 2, experimental_backgroundImage: GLINT }, glint]} />
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
