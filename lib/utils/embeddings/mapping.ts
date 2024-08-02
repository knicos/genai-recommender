import { Embedding } from '@base/utils/embedding';
import AutoEncoder from '../../services/content/autoencoder';

export interface Point {
    x: number;
    y: number;
}

const EPOCHS = 50;

export default class EmbeddingMapper {
    private encoder?: AutoEncoder;

    public async train(embeddings: Embedding[]) {
        this.encoder = new AutoEncoder();
        this.encoder.create(2, 20, [8]);
        await this.encoder.train(embeddings, EPOCHS);
    }

    public async embeddingToPoint(embedding: Embedding): Promise<Point> {
        if (!this.encoder) {
            throw new Error('no_mapping_encoder');
        }
        if (this.encoder.isTrained()) {
            const p = this.encoder.generate([embedding])[0];
            return { x: p[0], y: p[1] };
        } else {
            throw new Error('encoder_not_trained');
        }
    }

    public async mapEmbeddingsToPoints(embeddings: Embedding[]): Promise<Point[]> {
        if (!this.encoder || !this.encoder.isTrained()) {
            // const nodes = getNodesByType('content');
            // const embeddings = nodes.map((n) => getContentMetadata(n)?.embedding || []);
            await this.train(embeddings);
        }
        if (!this.encoder) {
            throw new Error('no_mapping_encoder');
        }

        const ps = this.encoder.generate(embeddings);
        let maxX = Number.NEGATIVE_INFINITY;
        let minX = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        ps.forEach((point) => {
            maxX = Math.max(maxX, point[0]);
            minX = Math.min(minX, point[0]);
            maxY = Math.max(maxY, point[1]);
            minY = Math.min(minY, point[1]);
        });

        const dX = maxX - minX;
        const dY = maxY - minY;

        return ps.map((p) => ({ x: (p[0] - minX) / dX, y: (p[1] - minY) / dY }));
    }
}
