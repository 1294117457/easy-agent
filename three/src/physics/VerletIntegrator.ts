import * as THREE from 'three';
import { Particle } from './Particle';
import { Spring } from './Spring';

/**
 * Verlet 积分器 — 管理所有粒子的物理更新
 */
export class VerletIntegrator {
  private particles: Particle[] = [];
  private springs: Spring[] = [];
  private gravity: THREE.Vector3;
  private damping: number;
  private constraintIterations: number;

  constructor(
    //重力调整---------------------------------------------------------------------111111111111111111111111111111111
    gravity = new THREE.Vector3(0, -0.8, 0),
    damping = 2.98,
    constraintIterations = 12,
  ) {
    this.gravity = gravity;
    this.damping = damping;
    this.constraintIterations = constraintIterations;
  }
//////////////////////////////////////////////////////////////
  addParticle(particle: Particle): void {
    this.particles.push(particle);
  }

  addSpring(spring: Spring): void {
    this.springs.push(spring);
  }

  getParticles(): Particle[] {
    return this.particles;
  }

  getSprings(): Spring[] {
    return this.springs;
  }

  /** 固定时间步长的物理更新 */
  update(dt: number, windForce?: THREE.Vector3): void {
    // 1. 对每个粒子施加外力（重力 + 风力）
    for (const p of this.particles) {
      if (p.pinned) continue;
      // 重力
      p.applyForce(this.gravity.clone().multiplyScalar(p.mass));
      // 风力
      if (windForce) {
        p.applyForce(windForce.clone().multiplyScalar(p.mass));
      }
    }

    // 2. Verlet 积分
    for (const p of this.particles) {
      p.integrate(dt, this.damping);
    }

    // 3. 约束迭代求解
    for (let i = 0; i < this.constraintIterations; i++) {
      for (const spring of this.springs) {
        spring.solve();
      }
    }
  }

  /** 清空所有粒子和弹簧 */
  clear(): void {
    this.particles = [];
    this.springs = [];
  }
}
