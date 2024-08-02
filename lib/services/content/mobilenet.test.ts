import { describe, it } from 'vitest';
import MobileNetEmbedding from './mobilenet';

function createImage(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, width, height);
    }

    return canvas;
}

describe('MobileNetEmbedding', () => {
    it('can generate an embedding', { timeout: 20000 }, async ({ expect }) => {
        const mnet = new MobileNetEmbedding();
        const embedding = await mnet.generateEmbedding(createImage(224, 224));
        expect(embedding).toHaveLength(1280);
    });
});
