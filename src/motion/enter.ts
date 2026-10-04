import { FadeIn, FadeInDown, FadeInRight, FadeOut, ZoomIn } from 'react-native-reanimated';
import { duration, staggerStep } from './tokens';

/**
 * Entrance presets. Content rises about 25 px while fading in, on a spring,
 * staggered by index so a section reads top-to-bottom like a sentence.
 * All presets respect the system "reduce motion" setting.
 *
 * Only predefined animations with modifiers are used here. Custom initial
 * values (`withInitialValues`) make Reanimated 4.5 on web pin the element
 * with `position: absolute` a few seconds after it has entered, which
 * breaks the page layout.
 */
export const enter = {
  rise: (index = 0, base = 0) =>
    FadeInDown.springify(560)
      .dampingRatio(0.9)
      .delay(base + index * staggerStep),
  fade: (index = 0, base = 0) => FadeIn.duration(duration.slow).delay(base + index * staggerStep),
  slide: (index = 0, base = 0) =>
    FadeInRight.springify(520)
      .dampingRatio(0.92)
      .delay(base + index * staggerStep),
  pop: (index = 0, base = 0) =>
    ZoomIn.springify(440)
      .dampingRatio(0.7)
      .delay(base + index * staggerStep),
  out: () => FadeOut.duration(duration.fast),
};
