import { Particle } from './Particle';

/**
 * 弹簧约束 — 连接两个粒子，保持自然长度
 */
export class Spring {
  public p1: Particle;
  public p2: Particle;
  public restLength: number;
  public stiffness: number;

  constructor(
    p1: Particle,
    p2: Particle,
    stiffness = 1.0,
  ) {
    this.p1 = p1;
    this.p2 = p2;
    this.restLength = p1.position.distanceTo(p2.position);
    this.stiffness = stiffness;
  }

  /**
   * 求解弹簧约束 — Position-Based Dynamics
   * 返回两个粒子各自需要修正的偏移量
   */
  solve(): void {
    const delta = this.p2.position.clone().sub(this.p1.position);
    const currentLength = delta.length();

    if (currentLength === 0) return; // 避免除零

    // 修正量 = 方向 * (当前长度 - 自然长度)
    const difference = (currentLength - this.restLength) / currentLength;
    const correction = delta.multiplyScalar(difference * 0.5 * this.stiffness);

    // 非固定点分担修正量
    if (!this.p1.pinned) this.p1.position.add(correction);
    if (!this.p2.pinned) this.p2.position.sub(correction);
  }
}
