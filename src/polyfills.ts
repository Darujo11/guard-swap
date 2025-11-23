// Polyfills para compatibilidade com Android 8+ e iOS 13+
// Este arquivo carrega polyfills condicionalmente apenas se necessário

// Promise (para Android < 8)
if (typeof Promise === 'undefined') {
  console.warn('⚠️ Promise não suportado, considerando adicionar polyfill');
}

// fetch (para Android < 8)
if (typeof fetch === 'undefined') {
  console.warn('⚠️ fetch não suportado, considerando adicionar polyfill');
}

// Object.entries (ES2017)
if (!Object.entries) {
  Object.entries = function(obj: any) {
    const ownProps = Object.keys(obj);
    let i = ownProps.length;
    const resArray = new Array(i);
    while (i--) {
      resArray[i] = [ownProps[i], obj[ownProps[i]]];
    }
    return resArray;
  };
}

// Object.values (ES2017)
if (!Object.values) {
  Object.values = function(obj: any) {
    const ownProps = Object.keys(obj);
    let i = ownProps.length;
    const resArray = new Array(i);
    while (i--) {
      resArray[i] = obj[ownProps[i]];
    }
    return resArray;
  };
}

// Array.prototype.flat (ES2019) - Implementação simplificada
if (!(Array.prototype as any).flat) {
  (Array.prototype as any).flat = function(depth: number = 1): any[] {
    const arr = this as any[];
    const flatten = (arr: any[], d: number): any[] => {
      return d > 0
        ? arr.reduce((acc: any[], val: any) => 
            acc.concat(Array.isArray(val) ? flatten(val, d - 1) : val), [])
        : arr.slice();
    };
    return flatten(arr, depth);
  };
}

// Array.prototype.flatMap (ES2019) - Implementação simplificada
if (!(Array.prototype as any).flatMap) {
  (Array.prototype as any).flatMap = function(callback: (value: any, index: number, array: any[]) => any): any[] {
    return (this as any[]).map(callback).flat();
  };
}

console.log('✅ Polyfills carregados com sucesso');
