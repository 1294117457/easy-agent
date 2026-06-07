import * as THREE from 'three';

/**
 * 风力系统 — 基于简谐振动的动态风力
 */
export class Wind {
  private strength: number;
  private time = 0;

  constructor(strength = 2.0) {
    this.strength = strength;
  }

  update(dt: number): THREE.Vector3 {
    this.time += dt;

    // 三个轴分别用不同频率的 sin/cos，产生自然的紊乱效果
    const wx = Math.sin(this.time * 0.7) * Math.cos(this.time * 0.3) * this.strength;
    const wy = Math.sin(this.time * 0.5) * 0.3 * this.strength;
    const wz = Math.cos(this.time * 0.4) * Math.sin(this.time * 0.2) * this.strength * 0.5;

    return new THREE.Vector3(wx, wy, wz);
  }

  setStrength(s: number): void {
    this.strength = s;
  }
}
