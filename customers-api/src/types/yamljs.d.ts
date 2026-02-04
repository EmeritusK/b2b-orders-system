declare module 'yamljs' {
  export function load(path: string): any;
  export function parse(yamlString: string): any;
  export function stringify(obj: any, inline?: number): string;
}
