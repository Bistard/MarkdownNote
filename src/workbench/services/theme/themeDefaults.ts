import { Color, ColorMap } from "src/base/common/color";
import { assert } from "src/base/common/utilities/panic";

export const THEME_COLORS = <const> {

    // primary (brand)

    teal:                assert(Color.parseHex('#2aa882')),
    mediumTeal:          assert(Color.parseHex('#a3d0c3')),
    lightTeal:           assert(Color.parseHex('#d0ebe3')),
    lighterTeal:         assert(Color.parseHex('#f0f8f5')),
    white:               assert(Color.parseHex('#ffffff')),

    // primary (text)

    primary:             assert(Color.parseHex('#211f27')),
    secondary:           assert(Color.parseHex('#5a564d')),
    ternary:             assert(Color.parseHex('#949393')),
    subtext:             assert(Color.parseHex('#b5b5b5')),
    middle:              assert(Color.parseHex('#bbbbbb')),
    subicon:             assert(Color.parseHex('#cccccc')),
    stroke:              assert(Color.parseHex('#e2e2e2')),
    lightstroke:         assert(Color.parseHex('#eaeaea')),
    light:               assert(Color.parseHex('#f0f0f0')),
    sidebg:              assert(Color.parseHex('#fcfcfc')),

    // utility
    goldenrod:           assert(Color.parseHex('#F1AD00')),
    lightgoldenrod:     assert(Color.parseHex('#f9de99')),
    crimson:             assert(Color.parseHex('#DA3A34')),
    lightcrimson:       assert(Color.parseHex('#ec9c99'))
    
    // light theme special
    
    // dark theme special

} satisfies ColorMap;

/**
 * A color mapping that is shared in the preset color themes.
 */
export const SHARED_COLORS_DEFAULT: ColorMap = {
    // TODO
};
