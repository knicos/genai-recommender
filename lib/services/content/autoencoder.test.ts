import { describe, it } from 'vitest';
import AutoEncoder from './autoencoder';

const data = [
    [1, 0, 1, 1, 0, 0, 0, 0, 1, 0],
    [1, 1, 1, 1, 0, 0, 0, 0, 1, 0],
    [1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    [1, 1, 1, 1, 0, 0, 0, 0, 1, 0],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 0, 0, 0, 1, 0],
    [1, 0, 1, 1, 0, 0, 0, 0, 1, 0],
    [1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    [1, 0, 1, 1, 0, 0, 0, 0, 1, 0],
    [1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    [1, 0, 1, 1, 0, 0, 0, 0, 1, 0],
];

describe('AutoEncoder', () => {
    it('can be created with no extra layers', async ({ expect }) => {
        const encoder = new AutoEncoder();
        encoder.create(20, 100, []);
        expect(encoder.encoder).toBeTruthy();
    });

    it('can be created with extra layers', async ({ expect }) => {
        const encoder = new AutoEncoder();
        encoder.create(20, 100, [10]);
        expect(encoder.encoder).toBeTruthy();
    });

    it('can be trained', async ({ expect }) => {
        const encoder = new AutoEncoder();
        encoder.create(2, 10, []);

        await encoder.train(data, 5);

        expect(encoder.isTrained()).toBe(true);
    });

    it('can generate an encoding', async ({ expect }) => {
        const encoder = new AutoEncoder();
        encoder.create(2, 10, []);

        await encoder.train(data, 5);

        const embeddings = encoder.generate([[1, 0, 0, 1, 0, 0, 0, 0, 1, 0]]);
        expect(embeddings).toHaveLength(1);
        expect(embeddings[0]).toHaveLength(2);
    });

    it('loads from a saved encoder', async ({ expect }) => {
        const encoder = new AutoEncoder();
        encoder.create(2, 10, [5]);
        await encoder.train(data, 5);
        const embeddings1 = encoder.generate([[1, 0, 0, 1, 0, 0, 0, 0, 1, 0]]);

        const blob = await encoder.save();
        expect(blob).toBeInstanceOf(Blob);
        expect(blob?.size).toBeGreaterThan(0);

        if (!blob) return;

        const newEncoder = new AutoEncoder();
        await newEncoder.load(blob);
        const embeddings2 = encoder.generate([[1, 0, 0, 1, 0, 0, 0, 0, 1, 0]]);
        expect(embeddings2).toHaveLength(1);
        expect(embeddings2[0]).toHaveLength(2);
        expect(embeddings2[0][0]).toBeCloseTo(embeddings1[0][0]);
        expect(embeddings2[0][1]).toBeCloseTo(embeddings1[0][1]);
    });
});
