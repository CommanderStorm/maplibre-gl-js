import {loadGeometry} from './load_geometry.ts';
import type Point from '@mapbox/point-geometry';
import type {Feature} from '@maplibre/maplibre-gl-style-spec';
import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

type EvaluationFeature = Feature & { geometry: Point[][] };
/**
 * Construct a new feature based on a VectorTileFeatureLike for expression evaluation, the geometry of which
 * will be loaded based on necessity.
 * @param feature - the feature to evaluate
 * @param needGeometry - if set to true this will load the geometry
 */
export function toEvaluationFeature(feature: VectorTileFeatureLike, needGeometry: boolean): EvaluationFeature {
    return {type: feature.type,
        id: feature.id,
        properties: feature.properties,
        geometry: needGeometry ? loadGeometry(feature) : []};
}

/**
 * Stub feature for evaluating a feature-constant filter (`FeatureFilter.isConstant`)
 * a single time per tile. Such a filter never reads the feature, so these fields are
 * never inspected — they exist only to satisfy the evaluation signature.
 */
export const EMPTY_EVALUATION_FEATURE: EvaluationFeature = {type: 1, properties: {}, geometry: []};
