import * as tf from '@tensorflow/tfjs';
import JSZip from 'jszip';

export interface AutoEncoderOptions {
    layers?: number[];
    learningRate?: number;
    l1?: number;
    noRegularization?: boolean;
    outputActivation?: 'linear' | 'sigmoid' | 'tanh' | 'relu';
    loss?: 'meanSquaredError' | 'cosineProximity';
}

export default class AutoEncoder {
    public model?: tf.LayersModel;
    public metadata?: unknown;
    public encoderLayers?: tf.layers.Layer[];
    public decoderLayers?: tf.layers.Layer[];
    private trained: boolean = false;
    private trainingPromise?: Promise<tf.History>;
    public encoder?: tf.LayersModel;

    constructor(encoder?: Blob) {
        if (encoder) {
            this.load(encoder);
        }
    }

    public async load(model: Blob) {
        const zip = await JSZip.loadAsync(model);

        const modelData: {
            model?: tf.io.ModelJSON;
            weights?: ArrayBuffer;
        } = {};

        const promises: Promise<void>[] = [];
        zip.forEach((_: string, data: JSZip.JSZipObject) => {
            if (data.name === 'model.json') {
                promises.push(
                    data.async('string').then((r) => {
                        modelData.model = JSON.parse(r) as tf.io.ModelJSON;
                    })
                );
            } else if (data.name === 'weights.bin') {
                promises.push(
                    data.async('arraybuffer').then((r) => {
                        modelData.weights = r;
                    })
                );
            }
        });

        await Promise.all(promises);

        if (modelData.model && modelData.weights) {
            this.encoder = await tf.loadLayersModel({
                load: async () => {
                    return {
                        modelTopology: modelData.model?.modelTopology,
                        weightData: modelData.weights,
                        weightSpecs: modelData.model?.weightsManifest[0].weights,
                    };
                },
            });
        }
    }

    public create(dim: number, inDim = 1280, opts?: AutoEncoderOptions) {
        // Now use an autoencoder to reduce it.
        const model = tf.sequential();
        const layerStructure = opts?.layers || [];
        const encoder = [
            tf.layers.dense({
                units: layerStructure.length > 0 ? layerStructure[0] : dim,
                inputShape: [inDim],
                activation: layerStructure.length > 0 ? 'relu' : opts?.outputActivation || 'linear',
                kernelInitializer: 'glorotNormal',
                biasInitializer: 'zeros',
                kernelRegularizer:
                    layerStructure.length > 0 && !opts?.noRegularization
                        ? undefined
                        : tf.regularizers.l1({ l1: opts?.l1 || 0.01 }),
            }),
            ...layerStructure.slice(1).map((units) =>
                tf.layers.dense({
                    units,
                    activation: 'relu',
                    kernelInitializer: 'glorotNormal',
                    biasInitializer: 'zeros',
                })
            ),
        ];

        // Add bottleneck layer
        if (layerStructure.length > 0) {
            encoder.push(
                tf.layers.dense({
                    units: dim,
                    activation: opts?.outputActivation || 'linear',
                    kernelInitializer: 'glorotNormal',
                    biasInitializer: 'zeros',
                    kernelRegularizer: opts?.noRegularization
                        ? undefined
                        : tf.regularizers.l1({ l1: opts?.l1 || 0.01 }),
                })
            );
        }

        // Decoder
        const decoder = [
            ...layerStructure
                .slice()
                .reverse()
                .map((units) =>
                    tf.layers.dense({
                        units,
                        activation: 'relu',
                        kernelInitializer: 'glorotNormal',
                        biasInitializer: 'zeros',
                    })
                ),
            tf.layers.dense({
                units: inDim,
                activation: 'linear',
                kernelInitializer: 'glorotNormal',
                biasInitializer: 'zeros',
            }),
        ];

        encoder.forEach((e) => model.add(e));
        decoder.forEach((d) => model.add(d));
        model.compile({
            optimizer: tf.train.adam(opts?.learningRate || 0.001),
            loss: opts?.loss || 'meanSquaredError',
        });
        this.model = model;
        this.encoderLayers = encoder;
        this.decoderLayers = decoder;

        const predictor = tf.sequential();
        this.encoderLayers.forEach((e) => predictor.add(e));
        this.encoder = predictor;
    }

    public async save() {
        if (this.encoder) {
            const zip = new JSZip();

            const metadata = JSON.stringify({});
            zip.file('metadata.json', metadata);

            let zipData = new Blob();
            await this.encoder.save({
                save: async (artifact: tf.io.ModelArtifacts) => {
                    if (artifact.weightData instanceof ArrayBuffer) {
                        zip.file('weights.bin', artifact.weightData);
                    }
                    if (artifact.modelTopology) {
                        const model = JSON.stringify({
                            modelTopology: artifact.modelTopology,
                            weightsManifest: [{ paths: ['./weights.bin'], weights: artifact.weightSpecs }],
                        });
                        zip.file('model.json', model);
                    }

                    if (this.metadata) {
                        zip.file('metadata.json', JSON.stringify(this.metadata));
                    }

                    zipData = await zip.generateAsync({ type: 'blob' });
                    return {
                        modelArtifactsInfo: {
                            dateSaved: new Date(),
                            modelTopologyType: 'JSON',
                        },
                    } as tf.io.SaveResult;
                },
            });

            return zipData;
        } else {
            console.warn('No model to save');
        }
    }

    async train(data: number[][], epochs = 1000, onEpochEnd?: (e: number, logs?: tf.Logs) => void) {
        if (!this.model) return;

        if (!this.trainingPromise) {
            this.trainingPromise = new Promise((resolve, reject) => {
                if (!this.model) {
                    reject('no_model');
                    return;
                }
                const xs = tf.tensor2d(data);
                this.model
                    .fit(xs, xs, {
                        epochs,
                        batchSize: 32,
                        shuffle: true,
                        validationSplit: 0.1,
                        callbacks: { onEpochEnd: onEpochEnd },
                    })
                    .then((h) => {
                        xs.dispose();
                        this.trained = true;
                        this.trainingPromise = undefined;
                        resolve(h);
                    });
            });
        }
        return await this.trainingPromise;
    }

    isTrained() {
        return this.trained;
    }

    generate(data: number[][]): number[][] {
        if (!this.encoder) return [];
        const xs = tf.tensor2d(data);
        const result = tf.tidy(() => {
            const r = this.encoder?.predict(xs);
            return r;
        });

        xs.dispose();

        if (!Array.isArray(result) && result) {
            return result.arraySync() as number[][];
        } else {
            return [];
        }
    }

    dispose() {
        if (this.model) {
            this.model.dispose();
        } else if (this.encoder) {
            this.encoder.dispose();
        }
    }
}
