import * as THREE from 'three';

/**
 * 粒子（质点）— 布料模拟的基本单元
 */
export class Particle {
  public position: THREE.Vector3;
  public prevPosition: THREE.Vector3;
  public acceleration: THREE.Vector3;
  public mass: number;
  public pinned: boolean;

  constructor(
    x: number,
    y: number,
    z: number,
    mass = 1.0,
    pinned = false,
  ) {
    this.position = new THREE.Vector3(x, y, z);
    this.prevPosition = new THREE.Vector3(x, y, z);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.mass = mass;
    this.pinned = pinned;
  }

  /** 施加力到粒子上（F = ma => a = F/m） */
  applyForce(force: THREE.Vector3): void {
    if (this.pinned) return;
    this.acceleration.addScaledVector(force, 1 / this.mass);
  }

  /** Verlet 积分一步 */
  integrate(dt: number, damping: number): void {
    if (this.pinned) return;

    // velocity ≈ (position - prevPosition) * damping
    const velocity = this.position.clone().sub(this.prevPosition);
    velocity.multiplyScalar(damping);

    // prevPosition ← current position
    this.prevPosition.copy(this.position);

    // position += velocity + acceleration * dt²
    this.position.add(velocity);
    this.position.addScaledVector(this.acceleration, dt * dt);

    // 重置加速度（每帧重新计算）
    this.acceleration.set(0, 0, 0);
  }

  /** 强制设置位置（用于固定点和碰撞响应） */
  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    if (this.pinned) {
      this.prevPosition.set(x, y, z);
    }
  }

  /** 重置到初始位置 */
  reset(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.prevPosition.set(x, y, z);
    this.acceleration.set(0, 0, 0);
  }
}
