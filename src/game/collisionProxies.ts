import * as THREE from 'three';
import type { SolidCollider } from './collision';

/**
 * Dedicated Three.js layer for simplified invisible collision proxy meshes and terrain.
 * Camera wall pull-in and projectile raycasters test ONLY this layer (non-recursively),
 * preventing camera flicker/snapping on detailed decorative voxel sub-meshes (banners,
 * ivy clusters, flowerboxes, spinning windmill sails, foliage).
 */
export const COLLISION_PROXY_LAYER = 1;
export const COLLISION_INACTIVE_LAYER = 2;

export class CollisionProxyRegistry {
  readonly group: THREE.Group;
  readonly raycastTargets: THREE.Object3D[] = [];

  private readonly boxGeo: THREE.BoxGeometry;
  private readonly cylGeo: THREE.CylinderGeometry;
  private readonly proxyMat: THREE.MeshBasicMaterial;
  private readonly meshByCollider = new Map<SolidCollider, THREE.Mesh>();

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'SimplifiedCollisionProxies';
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
    // Invisible to WebGLRenderer (0 draw calls) while remaining fully raycastable!
    this.proxyMat = new THREE.MeshBasicMaterial({
      visible: false,
      depthWrite: false,
      colorWrite: false,
    });
  }

  /** Register a static surface (e.g. terrainMesh) directly on the proxy raycast layer. */
  registerTerrain(terrainMesh: THREE.Mesh): void {
    terrainMesh.layers.enable(COLLISION_PROXY_LAYER);
    this.raycastTargets.push(terrainMesh);
  }

  /** Create and bind a simplified invisible proxy mesh for a SolidCollider. */
  register(collider: SolidCollider): THREE.Mesh | null {
    if (collider.blocksCamera === false || collider.ramp) {
      return null;
    }

    const height = Math.max(0.2, collider.maxY - collider.minY);
    const mesh = new THREE.Mesh(
      collider.kind === 'cylinder' ? this.cylGeo : this.boxGeo,
      this.proxyMat
    );
    mesh.name = `proxy_${collider.id}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.colliderId = collider.id;
    mesh.matrixAutoUpdate = false;

    this.applyTransform(mesh, collider, height);
    mesh.layers.set(collider.active ? COLLISION_PROXY_LAYER : COLLISION_INACTIVE_LAYER);

    this.group.add(mesh);
    this.meshByCollider.set(collider, mesh);
    this.raycastTargets.push(mesh);
    return mesh;
  }

  /** Sync a dynamic collider's position/active state (e.g. Cracked Boulder, Stasis Boulder, Cryonis Pillar). */
  sync(collider: SolidCollider): void {
    const mesh = this.meshByCollider.get(collider);
    if (!mesh) return;
    mesh.layers.set(collider.active ? COLLISION_PROXY_LAYER : COLLISION_INACTIVE_LAYER);
    if (collider.active) {
      const height = Math.max(0.2, collider.maxY - collider.minY);
      this.applyTransform(mesh, collider, height);
    }
  }

  /** Remove a transient collider's invisible proxy (e.g. evicted Cryonis Ice Pillar). */
  remove(collider: SolidCollider): void {
    const mesh = this.meshByCollider.get(collider);
    if (!mesh) return;
    this.group.remove(mesh);
    this.meshByCollider.delete(collider);
    const idx = this.raycastTargets.indexOf(mesh);
    if (idx >= 0) this.raycastTargets.splice(idx, 1);
  }

  private applyTransform(mesh: THREE.Mesh, c: SolidCollider, height: number): void {
    mesh.position.set(c.x, (c.minY + c.maxY) * 0.5, c.z);
    mesh.rotation.set(0, c.rotY ?? 0, 0);
    if (c.kind === 'cylinder') {
      mesh.scale.set(c.halfX, height, c.halfX);
    } else {
      mesh.scale.set(c.halfX * 2, height, c.halfZ * 2);
    }
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
  }

  dispose(): void {
    this.boxGeo.dispose();
    this.cylGeo.dispose();
    this.proxyMat.dispose();
    this.meshByCollider.clear();
    this.raycastTargets.length = 0;
  }
}
