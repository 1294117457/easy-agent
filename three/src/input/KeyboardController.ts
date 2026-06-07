/**
 * 键盘控制器 — 追踪当前按下的按键
 */
export class KeyboardController {
  private keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    // 防止焦点丢失时按键卡住
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  isPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  getKeys(): Set<string> {
    return this.keys;
  }

  /** 清除指定按键（防止一帧内重复触发） */
  clear(key: string): void {
    this.keys.delete(key.toLowerCase());
  }
}
