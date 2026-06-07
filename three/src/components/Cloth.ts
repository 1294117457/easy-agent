import * as THREE from 'three';
import { Particle, Spring, VerletIntegrator } from '../physics';

/**
 * 布料系统 — 网格弹簧-质点系统 + Three.js 渲染
 */
export class Cloth {
  // === 网格参数 ===
  public readonly width: number;
  public readonly height: number;
  public readonly segX: number;  // X 方向分段数
  public readonly segY: number;  // Y 方向分段数
  public readonly thickness = 0.05; // 碰撞厚度

  // === 物理系统 ===
  private integrator: VerletIntegrator;
  private particles: Particle[][] = []; // 2D 网格便于索引
  private allParticles: Particle[] = [];
  private springs: Spring[] = [];

  // === 渲染 ===
  public mesh!: THREE.Mesh;
  private geometry!: THREE.PlaneGeometry;
  private pinnedParticleIndices: Array<{ i: number; j: number }> = [];

  // === 初始位置记录（用于重置） ===
  private initPositions: Array<[number, number, number]> = [];

  constructor(
    scene: THREE.Scene,
    width = 2.5,
    height = 3.0,
    segX = 12,
    segY = 15,
    position?: THREE.Vector3,
  ) {
    this.width = width;
    this.height = height;
    this.segX = segX;
    this.segY = segY;

    this.integrator = new VerletIntegrator(
      new THREE.Vector3(0, -9.8, 0),
      0.98,   // damping
      10,     // constraint iterations
    );

    this._createParticles(position);
    this._createSprings();
    this._createMesh(scene);
  }

  private _createParticles(position?: THREE.Vector3): void {
    const startX = position ? position.x - this.width / 2 : -this.width / 2;
    const startY = position ? position.y : 3.0;
    const startZ = position ? position.z : 0;

    const stepX = this.width / this.segX;
    const stepY = this.height / this.segY;

    for (let j = 0; j <= this.segY; j++) {
      const row: Particle[] = [];
      for (let i = 0; i <= this.segX; i++) {
        const x = startX + i * stepX;
        const y = startY - j * stepY;
        const z = startZ;

        // 顶行粒子固定（挂在肩上）
        const pinned = j === 0;
        const p = new Particle(x, y, z, 1.0, pinned);

        row.push(p);
        this.allParticles.push(p);
        this.integrator.addParticle(p);

        // 记录初始位置
        this.initPositions.push([x, y, z]);

        if (pinned) {
          this.pinnedParticleIndices.push({ i, j });
        }
      }
      this.particles.push(row);
    }
  }

  private _createSprings(): void {
    const stiffness = 0.9;

    for (let j = 0; j <= this.segY; j++) {
      for (let i = 0; i <= this.segX; i++) {
        const p = this.particles[j][i];

        // 结构弹簧：水平相邻
        if (i < this.segX) {
          const spring = new Spring(p, this.particles[j][i + 1], stiffness);
          this.springs.push(spring);
          this.integrator.addSpring(spring);
        }

        // 结构弹簧：垂直相邻
        if (j < this.segY) {
          const spring = new Spring(p, this.particles[j + 1][i], stiffness);
          this.springs.push(spring);
          this.integrator.addSpring(spring);
        }

        // 剪切弹簧：对角线（增加剪切刚度）
        if (i < this.segX && j < this.segY) {
          const spring1 = new Spring(p, this.particles[j + 1][i + 1], stiffness * 0.5);
          const spring2 = new Spring(this.particles[j][i + 1], this.particles[j + 1][i], stiffness * 0.5);
          this.springs.push(spring1, spring2);
          this.integrator.addSpring(spring1);
          this.integrator.addSpring(spring2);
        }

        // 弯曲弹簧：跳一格的水平/垂直（防止过度折叠）
        if (i < this.segX - 1) {
          const spring = new Spring(p, this.particles[j][i + 2], stiffness * 0.3);
          this.springs.push(spring);
          this.integrator.addSpring(spring);
        }
        if (j < this.segY - 1) {
          const spring = new Spring(p, this.particles[j + 2][i], stiffness * 0.3);
          this.springs.push(spring);
          this.integrator.addSpring(spring);
        }
      }
    }
  }

  private _createMesh(scene: THREE.Scene): void {
    this.geometry = new THREE.PlaneGeometry(this.width, this.height, this.segX, this.segY);

    const material = new THREE.MeshStandardMaterial({
      color: 0xcc4444,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.0,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    // 初始同步
    this.syncMeshToParticles();
  }

  /** 每帧物理更新 */
  update(dt: number, windForce?: THREE.Vector3): void {
    this.integrator.update(dt, windForce);
    this.syncMeshToParticles();
  }

  /**
   * 绑定点同步 — 布料顶行粒子跟随角色肩部
   */
  bindToCharacter(bindPoints: THREE.Vector3[]): void {
    // bindPoints 的数量应该等于顶行粒子数量（segX + 1）
    // 如果不足，均匀插值
    const topRowCount = this.segX + 1;
    const topRow = this.particles[0];

    for (let i = 0; i < topRowCount; i++) {
      const p = topRow[i];
      if (p.pinned) {
        let targetPos: THREE.Vector3;
        if (bindPoints.length === topRowCount) {
          targetPos = bindPoints[i];
        } else {
          // 插值
          const t = i / (topRowCount - 1);
          const lower = Math.floor(t * (bindPoints.length - 1));
          const upper = Math.min(lower + 1, bindPoints.length - 1);
          const frac = t * (bindPoints.length - 1) - lower;
          targetPos = bindPoints[lower].clone().lerp(bindPoints[upper], frac);
        }
        p.setPosition(targetPos.x, targetPos.y, targetPos.z);
      }
    }
  }

  /**
   * 碰撞检测 — 布料粒子与角色胶囊体球排斥
   */
  collideWithCharacter(
    spheres: Array<{ center: THREE.Vector3; radius: number }>,
  ): void {
    for (const p of this.allParticles) {
      if (p.pinned) continue;

      for (const sphere of spheres) {
        const delta = p.position.clone().sub(sphere.center);
        const dist = delta.length();

        if (dist < sphere.radius + this.thickness && dist > 0.001) {
          // 将粒子推出球体
          const pushDir = delta.normalize();
          const penetration = sphere.radius + this.thickness - dist;
          p.position.addScaledVector(pushDir, penetration);
        }
      }
    }
  }

  /** 地面碰撞 */
  collideWithGround(groundY: number): void {
    for (const p of this.allParticles) {
      if (p.pinned) continue;
      if (p.position.y < groundY + this.thickness) {
        p.position.y = groundY + this.thickness;
      }
    }
  }

  /** 同步 Three.js 网格顶点到粒子位置 */
  private syncMeshToParticles(): void {
    const positions = this.geometry.attributes.position;

    for (let j = 0; j <= this.segY; j++) {
      for (let i = 0; i <= this.segX; i++) {
        const idx = j * (this.segX + 1) + i;
        const p = this.particles[j][i];
        positions.setXYZ(idx, p.position.x, p.position.y, p.position.z);
      }
    }

    positions.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  /** 重置布料到初始状态 */
  reset(): void {
    for (let k = 0; k < this.allParticles.length; k++) {
      const [x, y, z] = this.initPositions[k];
      this.allParticles[k].reset(x, y, z);
    }
    this.syncMeshToParticles();
  }
}
