import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Multi-GLB offline vehicle asset manager.
 * Loads locally bundled Draco-compressed supercar meshes from public/models/
 * using local Draco WASM decoders in public/draco/ (zero external runtime network requests).
 */
class SupercarAssetManager {
  private readonly templatePromises = new Map<string, Promise<THREE.Group>>();
  private readonly cachedTemplates = new Map<string, THREE.Group>();
  private dracoLoader: DRACOLoader | null = null;
  private gltfLoader: GLTFLoader | null = null;

  private ensureLoaders(): GLTFLoader {
    if (!this.gltfLoader) {
      const base = import.meta.env.BASE_URL || './';
      this.dracoLoader = new DRACOLoader();
      this.dracoLoader.setDecoderPath(`${base}draco/`);
      this.gltfLoader = new GLTFLoader();
      this.gltfLoader.setDRACOLoader(this.dracoLoader);
    }
    return this.gltfLoader;
  }

  public loadModel(modelFile = 'supercar.glb'): Promise<THREE.Group> {
    const cached = this.cachedTemplates.get(modelFile);
    if (cached) {
      return Promise.resolve(cached);
    }
    const pending = this.templatePromises.get(modelFile);
    if (pending) {
      return pending;
    }

    const base = import.meta.env.BASE_URL || './';
    const loader = this.ensureLoaders();

    const promise = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        `${base}models/${modelFile}`,
        (gltf) => {
          const root = gltf.scene;
          root.updateMatrixWorld(true);
          this.cachedTemplates.set(modelFile, root);
          resolve(root);
        },
        undefined,
        (err) => {
          this.templatePromises.delete(modelFile);
          reject(err);
        }
      );
    });

    this.templatePromises.set(modelFile, promise);
    return promise;
  }

  public getCachedSync(modelFile = 'supercar.glb'): THREE.Group | null {
    return this.cachedTemplates.get(modelFile) ?? null;
  }

  /**
   * Warm-loads all distinct vehicle models offline in order so garage switching
   * and AI race grids render immediately without fallback flashes.
   */
  public preloadAll(modelFiles: string[]): void {
    const unique = Array.from(new Set(modelFiles));
    if (unique.length === 0) return;
    // Load the primary showcase car immediately, then stagger the remaining fleet
    const [first, ...rest] = unique;
    void this.loadModel(first).finally(() => {
      for (const file of rest) {
        void this.loadModel(file).catch(() => {
          // Individual fallback handled per CarModel instance
        });
      }
    });
  }
}

export const supercarAssets = new SupercarAssetManager();
