import { Embedding } from '@base/utils/embedding';
import * as tf from '@tensorflow/tfjs';
const MODEL_PATH = `https://tmstore.blob.core.windows.net/models/mobilenet_v2_035_224/model.json`;

async function getImage(data: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        if (data) {
            img.src = data;
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.onabort = reject;
        } else {
            reject();
        }
    });
}

function capture(rasterElement: HTMLCanvasElement) {
    return tf.tidy(() => {
        const pixels = tf.browser.fromPixels(rasterElement);

        // crop the image so we're using the center square
        const cropped = cropTensor(pixels, false);

        // Expand the outer most dimension so we have a batch size of 1
        const batchedImage = cropped.expandDims(0);

        // Normalize the image between -1 and a1. The image comes in between 0-255
        // so we divide by 127 and subtract 1.
        return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
    });
}

export function cropTensor(img: tf.Tensor3D, grayscaleModel?: boolean, grayscaleInput?: boolean): tf.Tensor3D {
    const size = Math.min(img.shape[0], img.shape[1]);
    const centerHeight = img.shape[0] / 2;
    const beginHeight = centerHeight - size / 2;
    const centerWidth = img.shape[1] / 2;
    const beginWidth = centerWidth - size / 2;

    if (grayscaleModel && !grayscaleInput) {
        //cropped rgb data
        let grayscale_cropped = img.slice([beginHeight, beginWidth, 0], [size, size, 3]);

        grayscale_cropped = grayscale_cropped.reshape([size * size, 1, 3]);
        const rgb_weights = [0.2989, 0.587, 0.114];
        grayscale_cropped = tf.mul(grayscale_cropped, rgb_weights);
        grayscale_cropped = grayscale_cropped.reshape([size, size, 3]);

        grayscale_cropped = tf.sum(grayscale_cropped, -1);
        grayscale_cropped = tf.expandDims(grayscale_cropped, -1);

        return grayscale_cropped;
    }
    return img.slice([beginHeight, beginWidth, 0], [size, size, 3]);
}

function cropTo(
    image: HTMLImageElement,
    size: number,
    flipped = false,
    canvas: HTMLCanvasElement = document.createElement('canvas')
) {
    // image image, bitmap, or canvas
    const width = image.width;
    const height = image.height;

    const min = Math.min(width, height);
    const scale = size / min;
    const scaledW = Math.ceil(width * scale);
    const scaledH = Math.ceil(height * scale);
    const dx = scaledW - size;
    const dy = scaledH - size;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(image, ~~(dx / 2) * -1, ~~(dy / 2) * -1, scaledW, scaledH);

        // canvas is already sized and cropped to center correctly
        if (flipped) {
            ctx.scale(-1, 1);
            ctx.drawImage(canvas, size * -1, 0);
        }
    }

    return canvas;
}

export default class MobileNetEmbedding {
    private model?: tf.LayersModel;

    private async createMobileNet() {
        if (!this.model) {
            const mobilenet = await tf.loadLayersModel(MODEL_PATH);
            const layer = mobilenet.getLayer('out_relu');
            const truncatedModel = tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
            const m = tf.sequential();
            m.add(truncatedModel);
            m.add(tf.layers.globalAveragePooling2d({})); // go from shape [7, 7, 1280] to [1280]
            this.model = m;
        }
        return this.model;
    }

    public async generateEmbedding(data: string | HTMLCanvasElement): Promise<Embedding> {
        const model = await this.createMobileNet();

        let cropped: HTMLCanvasElement;

        if (data instanceof HTMLCanvasElement) {
            cropped = data;
        } else {
            const img = await getImage(data);
            cropped = cropTo(img, 224);
        }

        const logits = tf.tidy(() => {
            const captured = capture(cropped);
            return model?.predict(captured);
        });

        const values = logits ? await (logits as tf.Tensor<tf.Rank>).data() : [];
        tf.dispose(logits);
        return Array.from(values);
    }

    public async generateEmbeddings(data: (string | HTMLCanvasElement)[]): Promise<Embedding[]> {
        await this.createMobileNet();
        const promises = data.map((d) => this.generateEmbedding(d));
        return Promise.all(promises);
    }
}
