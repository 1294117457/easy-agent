import * as THREE from 'three';

/**
 * 角色系统 — 程序化胶囊体人形模型
 * 包含身体参数、胶囊体渲染、碰撞体、WASD 移动控制
 */
export class Character {
  // === 身体参数 ===
  public readonly bodyHeight = 2.0;    // 躯干高度
  public readonly bodyRadius = 0.35;   // 躯干半径
  public readonly headRadius = 0.4;     // 头部半径
  public readonly legHeight = 1.2;     // 腿部高度
  public readonly legRadius = 0.15;     // 腿部半径

  // === 世界状态 ===
  public mesh: THREE.Group;
  public position: THREE.Vector3;
  public rotation = 0; // Y 轴朝向角（弧度）

  // === 移动参数 ===
  private moveSpeed = 5.0;
  private turnSpeed = 3.0;
  private velocity = new THREE.Vector3();

  // === Three.js 对象 ===
  private bodyMesh!: THREE.Mesh;
  private headMesh!: THREE.Mesh;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private legAngle = 0; // 腿部行走动画角度

  constructor(scene: THREE.Scene) {
    this.position = new THREE.Vector3(0, 0, 0);
    this.mesh = new THREE.Group();
    this._buildMeshes();
    scene.add(this.mesh);
  }

  private _buildMeshes(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4a90d9,
      roughness: 0.6,
      metalness: 0.1,
    });

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffcc99,
      roughness: 0.8,
      metalness: 0.0,
    });

    const legMat = new THREE.MeshStandardMaterial({
      color: 0x2c5aa0,
      roughness: 0.7,
      metalness: 0.1,
    });

    // 头部
    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.headRadius, 16, 16),
      headMat,
    );
    this.headMesh.position.set(0, this.bodyHeight / 2 + this.headRadius + 0.05, 0);
    this.mesh.add(this.headMesh);

    // 躯干（胶囊体 = 圆柱 + 两个半球）
    const torsoLen = this.bodyHeight - this.headRadius * 2;
    const torsoGeo = new THREE.CylinderGeometry(
      this.bodyRadius,
      this.bodyRadius,
      torsoLen,
      16,
    );
    this.bodyMesh = new THREE.Mesh(torsoGeo, bodyMat);
    this.bodyMesh.position.set(
      0,
      this.bodyHeight / 2 + this.headRadius * 0.5,
      0,
    );
    this.mesh.add(this.bodyMesh);

    // 左腿
    this.leftLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(this.legRadius, this.legRadius, this.legHeight, 8),
      legMat,
    );
    this.leftLeg.position.set(-0.2, this.legHeight / 2, 0);
    this.mesh.add(this.leftLeg);

    // 右腿
    this.rightLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(this.legRadius, this.legRadius, this.legHeight, 8),
      legMat,
    );
    this.rightLeg.position.set(0.2, this.legHeight / 2, 0);
    this.mesh.add(this.rightLeg);
  }

  /** 每帧更新，根据键盘输入移动 */
  update(dt: number, keys: Set<string>): void {
    // 旋转
    if (keys.has('a') || keys.has('arrowleft')) {
      this.rotation += this.turnSpeed * dt;
    }
    if (keys.has('d') || keys.has('arrowright')) {
      this.rotation -= this.turnSpeed * dt;
    }

    // 前进/后退（角色朝向为 forward = (sin(rotation), 0, cos(rotation))）
    const forward = new THREE.Vector3(
      Math.sin(this.rotation),
      0,
      Math.cos(this.rotation),
    );

    let moving = false;
    if (keys.has('w') || keys.has('arrowup')) {
      this.position.addScaledVector(forward, this.moveSpeed * dt);
      moving = true;
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      this.position.addScaledVector(forward, -this.moveSpeed * dt);
      moving = true;
    }

    // 行走动画（腿摆动）
    if (moving) {
      this.legAngle += dt * 10;
    } else {
      this.legAngle *= 0.85; // 停下时逐渐归零
    }

    const legSwing = Math.sin(this.legAngle) * 0.4;
    this.leftLeg.rotation.x = legSwing;
    this.rightLeg.rotation.x = -legSwing;

    // 更新 mesh 世界变换
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
  }

  /**
   * 获取胶囊体世界空间包围信息，用于布料碰撞
   * 返回躯干 + 头部 + 腿部的世界坐标和半径
   */
  getCollisionSpheres(): Array<{ center: THREE.Vector3; radius: number }> {
    const worldPos = this.mesh.position;
    const rot = this.mesh.rotation.y;

    return [
      // 躯干（简化为球心在身体中部）
      {
        center: new THREE.Vector3(
          worldPos.x + Math.sin(rot) * 0,
          worldPos.y + this.bodyHeight / 2 + this.headRadius * 0.3,
          worldPos.z + Math.cos(rot) * 0,
        ),
        radius: this.bodyRadius,
      },
      // 头部
      {
        center: new THREE.Vector3(
          worldPos.x,
          worldPos.y + this.bodyHeight / 2 + this.headRadius * 2,
          worldPos.z,
        ),
        radius: this.headRadius,
      },
      // 左腿
      {
        center: new THREE.Vector3(
          worldPos.x + Math.sin(rot) * -0.2,
          worldPos.y + this.legHeight / 2,
          worldPos.z + Math.cos(rot) * -0.2,
        ),
        radius: this.legRadius,
      },
      // 右腿
      {
        center: new THREE.Vector3(
          worldPos.x + Math.sin(rot) * 0.2,
          worldPos.y + this.legHeight / 2,
          worldPos.z + Math.cos(rot) * 0.2,
        ),
        radius: this.legRadius,
      },
    ];
  }

  /**
   * 布料绑定点世界坐标 — 肩部（布料挂载位置）
   * 返回布料顶部固定粒子应该跟随的世界坐标
   */
  getBindPoints(): THREE.Vector3[] {
    const worldPos = this.mesh.position;
    const rot = this.mesh.rotation.y;
    const shoulderY = worldPos.y + this.bodyHeight - 0.7;
    const shoulderWidth = 0.4;
    const points: THREE.Vector3[] = [];

    // 肩部一排绑定点（对应布料顶行的粒子）
    for (let i = 0; i < 5; i++) {
      const t = i / 4; // 0 到 1
      const x = (t - 0.5) * 2 * shoulderWidth;
      points.push(
        new THREE.Vector3(
          worldPos.x + Math.cos(rot) * x,
          shoulderY,
          worldPos.z - Math.sin(rot) * x, 
        ),
      );
    }

    return points;
  }

  /** 获取胶囊体中心世界坐标 */
  getCenter(): THREE.Vector3 {
    return this.mesh.position.clone().add(new THREE.Vector3(0, this.bodyHeight / 2 + this.headRadius, 0));
  }

  /** 限制在地面范围内 */
  getFootY(): number {
    return this.position.y + this.legHeight;
  }
}
