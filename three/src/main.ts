import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Character } from './components/Character';
import { Cloth } from './components/Cloth';
import { Wind } from './components/Wind';
import { KeyboardController } from './input/KeyboardController';

// ============================================================================
// 场景初始化
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 20, 50);

// ============================================================================
// 相机
// ============================================================================
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(0, 6, 12);
camera.lookAt(0, 2, 0);

// === 轨道控制器：鼠标拖拽旋转 + 滚轮缩放 ===
// （渲染器创建完成后初始化，见下方 renderer 之后）

// ============================================================================
// 渲染器
// ============================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// === 轨道控制器：鼠标拖拽旋转 + 滚轮缩放 ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2;
controls.target.set(0, 2, 0);

// ============================================================================
// 光照
// ============================================================================
const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(10, 20, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -15;
sunLight.shadow.camera.right = 15;
sunLight.shadow.camera.top = 15;
sunLight.shadow.camera.bottom = -15;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
fillLight.position.set(-10, 5, -10);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffccaa, 0.2);
rimLight.position.set(0, 5, -15);
scene.add(rimLight);

// ============================================================================
// 地面
// ============================================================================
const groundGeo = new THREE.PlaneGeometry(50, 50, 20, 20);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a3a,
  roughness: 0.9,
  metalness: 0.1,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 地面网格线（装饰）
const gridHelper = new THREE.GridHelper(50, 50, 0x3a3a5a, 0x2a2a4a);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// ============================================================================
// 角色
// ============================================================================
const character = new Character(scene);

// ============================================================================
// 布料 — 披风（挂在背后）
// ============================================================================
const clothPos = new THREE.Vector3(0, 0, 0);
const cloth = new Cloth(scene, 1.5, 1.5, 12, 5, clothPos);//宽，长

// 给布料一个初始颜色（披风色）
(cloth.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x8833aa);//#58A0D1

// ============================================================================
// 风力
// ============================================================================
const wind = new Wind(1.5);

// ============================================================================
// 键盘控制
// ============================================================================
const keyboard = new KeyboardController();

// ============================================================================
// 物理时间步长（固定 1/60）
// ============================================================================
const FIXED_DT = 1 / 60;
let accumulator = 0;
let lastTime = performance.now();

// ============================================================================
// FPS 显示
// ============================================================================
const fpsDom = document.getElementById('fps')!;
const camModeText = document.getElementById('cam-mode-text')!;
let frameCount = 0;
let fpsTime = 0;

// ============================================================================
// 相机跟随参数
// ============================================================================
const cameraOffset = new THREE.Vector3(0, 4, 6);
const cameraLookOffset = new THREE.Vector3(0, 2, 0);
let cameraMode: 'orbit' | 'follow' = 'orbit'; // 当前相机模式

// ============================================================================
// 主循环
// ============================================================================
function animate(): void {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05); // 限制最大 dt 防止爆炸
  lastTime = now;

  // FPS 统计
  frameCount++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fpsDom.textContent = `${Math.round(frameCount / fpsTime)} FPS`;
    frameCount = 0;
    fpsTime = 0;
  }

  // === 按键处理 ===
  const keys = keyboard.getKeys();

  // 重置布料
  if (keyboard.isPressed('r')) {
    cloth.reset();
  }

  // === C 键切换相机模式 ===
  if (keyboard.isPressed('c')) {
    cameraMode = cameraMode === 'orbit' ? 'follow' : 'orbit';
    controls.enabled = cameraMode === 'orbit';
    camModeText.textContent = cameraMode === 'orbit' ? '手动旋转' : '跟随角色';
    keyboard.clear('c');
  }

  // === 更新角色 ===
  character.update(dt, keys);

  // === 更新布料绑定点 ===
  const bindPoints = character.getBindPoints();
  const behindPoints = bindPoints.map((p) => {
    const charPos = character.mesh.position;
    const rot = character.mesh.rotation.y;

    const behindDist = 0.3;
    const behindY = character.bodyHeight * 0.6;

    const localX = p.x - charPos.x;
    const localZ = -behindDist;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);

    return new THREE.Vector3(
      charPos.x + cosR * localX + sinR * localZ,
      charPos.y + behindY,
      charPos.z - sinR * localX + cosR * localZ,
    );
  });
  cloth.bindToCharacter(behindPoints);

  // === 物理更新（固定时间步长）===
  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    const windForce = wind.update(FIXED_DT);
    cloth.update(FIXED_DT, windForce);
    accumulator -= FIXED_DT;
  }

  // === 碰撞检测 ===
  cloth.collideWithCharacter(character.getCollisionSpheres());
  cloth.collideWithGround(character.getFootY() - character.legHeight);

  // === 相机更新 ===
  if (cameraMode === 'follow') {
    const charPos = character.position.clone();
    const targetCamPos = charPos.clone().add(cameraOffset);
    camera.position.lerp(targetCamPos, 0.08);
    const lookAt = charPos.clone().add(cameraLookOffset);
    camera.lookAt(lookAt);
  } else {
    controls.update();
  }

  // === 渲染 ===
  renderer.render(scene, camera);
}

// ============================================================================
// 窗口大小变化
// ============================================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// 启动
// ============================================================================
animate();
