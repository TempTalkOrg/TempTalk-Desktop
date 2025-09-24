export class MethodCache {
  private _methodMap: Map<string, any>;

  constructor() {
    this._methodMap = new Map();
  }

  public mapAddMethods(module: any, methods: string[]) {
    if (!module) {
      throw new Error('module is invalid.');
    }

    for (const method of methods) {
      if (this._methodMap.has(method)) {
        const found = this._methodMap.get(method);
        if (found !== module) {
          throw new Error('method name can not be duplicated in modules.');
        }
      }

      this._methodMap.set(method, module);
    }
  }

  public getByMethod(method: string) {
    return this._methodMap.get(method);
  }
}
