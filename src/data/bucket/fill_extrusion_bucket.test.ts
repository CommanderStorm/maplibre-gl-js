import {beforeAll, describe, test, expect} from 'vitest';
import {FillExtrusionBucket} from './fill_extrusion_bucket.ts';
import {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {type ZoomHistory} from '../../style/zoom_history.ts';
import {type BucketFeature, type BucketParameters} from '../bucket.ts';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile.ts';
import {type VectorTileLayerLike} from '@maplibre/vt-pbf';
import Point from '@mapbox/point-geometry';
import {CanonicalTileID} from '../../tile/tile_id.ts';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';

function createFillExtrusionBucket({id, layout, paint, globalState, availableImages}: CreateBucketParameters): FillExtrusionBucket {
    const layer = new FillExtrusionStyleLayer({
        id,
        type: 'fill-extrusion',
        layout,
        paint
    } as LayerSpecification, globalState);
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters,
        availableImages);

    return new FillExtrusionBucket({layers: [layer]} as BucketParameters<FillExtrusionStyleLayer>);
}

describe('FillExtrusionBucket', () => {
    let sourceLayer: VectorTileLayerLike;
    beforeAll(() => {
        // Load fill extrusion features from fixture tile.
        sourceLayer = loadVectorTile().layers.water;
    });

    test('FillExtrusionBucket uses a pre-tessellated roof mesh when the feature provides one', () => {
        // A square placed away from tile boundaries (so no side face is skipped),
        // already at internal extent, with a two-triangle roof mesh.
        const tessellation = {
            vertices: [1000, 1000, 3000, 1000, 3000, 3000, 1000, 3000],
            indices: [0, 1, 2, 0, 2, 3]
        };
        const outline: Point[][] = [[
            new Point(1000, 1000),
            new Point(3000, 1000),
            new Point(3000, 3000),
            new Point(1000, 3000),
            new Point(1000, 1000)
        ]];
        const canonical = new CanonicalTileID(20, 1, 1);

        const tessellatedBucket = createFillExtrusionBucket({id: 'test', layout: {}});
        tessellatedBucket.addFeature({type: 3, tessellation} as unknown as BucketFeature, outline, undefined, canonical, undefined, SubdivisionGranularitySetting.noSubdivision);

        // 4 side faces (4 vertices / 2 triangles each) + 4 roof vertices / 2 roof triangles.
        expect(tessellatedBucket.layoutVertexArray).toHaveLength(20);
        expect(tessellatedBucket.indexArray).toHaveLength(10);
        // One centroid entry is emitted per added vertex.
        expect(tessellatedBucket.centroidVertexArray).toHaveLength(20);

        // The earcut fallback for the same square must produce an equivalent mesh.
        const earcutBucket = createFillExtrusionBucket({id: 'test', layout: {}});
        earcutBucket.addFeature({type: 3} as BucketFeature, outline, undefined, canonical, undefined, SubdivisionGranularitySetting.noSubdivision);
        expect(tessellatedBucket.layoutVertexArray.length).toBe(earcutBucket.layoutVertexArray.length);
        expect(tessellatedBucket.indexArray.length).toBe(earcutBucket.indexArray.length);
        expect(tessellatedBucket.centroidVertexArray.length).toBe(earcutBucket.centroidVertexArray.length);
    });

    test('FillExtrusionBucket fill-pattern with global-state', () => {
        const availableImages = [];
        const bucket = createFillExtrusionBucket({id: 'test',
            paint: {'fill-extrusion-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']]},
            globalState: {pattern: 'test-pattern'},
            availableImages
        });

        bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions(availableImages), undefined);

        expect(bucket.features.length).toBeGreaterThan(0);
        expect(bucket.features[0].patterns).toEqual({
            test: {min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern'}
        });
    });
});
