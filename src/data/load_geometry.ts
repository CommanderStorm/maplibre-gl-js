import {warnOnce, clamp} from '../util/util.ts';

import {EXTENT} from './extent.ts';

import type Point from '@mapbox/point-geometry';
import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

// These bounds define the minimum and maximum supported coordinate values.
// While visible coordinates are within [0, EXTENT], tiles may theoretically
// contain coordinates within [-Infinity, Infinity]. Our range is limited by the
// number of bits used to represent the coordinate.
const BITS = 15;
const MAX = Math.pow(2, BITS - 1) - 1;
const MIN = -MAX - 1;

/**
 * Loads a geometry from a VectorTileFeatureLike and scales it to the common extent
 * used internally.
 * @param feature - the vector tile feature to load
 */
export function loadGeometry(feature: VectorTileFeatureLike): Point[][] {
    const scale = EXTENT / feature.extent;
    const geometry = feature.loadGeometry();
    for (const ring of geometry) {
        for (const point of ring) {
            // round here because mapbox-gl-native uses integers to represent
            // points and we need to do the same to avoid rendering differences.
            const x = Math.round(point.x * scale);
            const y = Math.round(point.y * scale);

            point.x = clamp(x, MIN, MAX);
            point.y = clamp(y, MIN, MAX);

            if (x < point.x || x > point.x + 1 || y < point.y || y > point.y + 1) {
                // warn when exceeding allowed extent except for the 1-px-off case
                // https://github.com/mapbox/mapbox-gl-js/issues/8992
                warnOnce('Geometry exceeds allowed extent, reduce your vector tile buffer size');
            }
        }
    }
    return geometry;
}

/**
 * Scales a pre-tessellated feature's interleaved x,y `vertices` from tile-extent
 * units to the common internal extent, applying the exact same rounding and
 * clamping as {@link loadGeometry}. This guarantees a tessellation vertex that
 * shares a tile coordinate with a geometry vertex maps to the same internal
 * integer coordinate, so triangles and outlines stay stitched together.
 * @param vertices - interleaved x,y coordinates in tile-extent units
 * @param extent - the feature's tile extent
 */
export function scaleTessellationVertices(vertices: ArrayLike<number>, extent: number): Int32Array {
    const scale = EXTENT / extent;
    // Rounded + clamped to the signed-15-bit range, so the values fit an Int32Array.
    const scaled = new Int32Array(vertices.length);
    for (let i = 0; i < vertices.length; i++) {
        scaled[i] = clamp(Math.round(vertices[i] * scale), MIN, MAX);
    }
    return scaled;
}
