/**
 * Dish stickers. Bundled cut-outs carry their own white die-cut edge; user photos become round stickers.
 * They are applied like real stickers: held above the tile, laid down from one side, pressed flat.
 */
import { Image } from 'expo-image';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

import { Display, riseIn } from '@/components/ui';
import { type Recipe, STICKERS } from '@/lib/data';
import { C } from '@/lib/theme';

const STICK_MS = 760;

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
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      {animate && enter === 'stick' && face !== 'placeholder' ? (
        <Animated.View entering={liftShadowIn(delay)} style={[StyleSheet.absoluteFill, { opacity: 0 }]}>
          <ShadowShape recipe={recipe} face={face} size={size} />
        </Animated.View>
      ) : null}
      <Animated.View entering={entering} style={{ flex: 1 }}>
        <FaceView recipe={recipe} face={face} size={size} />
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

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
