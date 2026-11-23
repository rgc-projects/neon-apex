import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Loads the locally bundled open-source supercar mesh (Ferrari 458 Italia by vicent091036, CC BY 4.0)
 * using local Draco WASM decoders in /draco/ (zero external runtime network requests).
 */
class SupercarAssetManager {
  private templatePromise: Promise<THREE.Group> | null = null;
  private cachedTemplate: THREE.Group | null = null;

  public loadTemplate(): Promise<THREE.Group> {
    if (this.cachedTemplate) {
      return Promise.resolve(this.cachedTemplate);
    }
    if (this.templatePromise) {
      return this.templatePromise;
    }

    this.templatePromise = new Promise((resolve, reject) => {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/draco/');

      const gltfLoader = new GLTFLoader();
      gltfLoader.setDRACOLoader(dracoLoader);

      gltfLoader.load(
        '/models/supercar.glb',
        (gltf) => {
          const root = gltf.scene;
          root.updateMatrixWorld(true);
          this.cachedTemplate = root;
          dracoLoader.dispose();
          resolve(root);
        },
        undefined,
        (err) => {
          dracoLoader.dispose();
          this.templatePromise = null;
          reject(err);
        }
      );
    });

    return this.templatePromise;
  }

  public getCachedSync(): THREE.Group | null {
    return this.cachedTemplate;
  }
}

export const supercarAssets = new SupercarAssetManager();
