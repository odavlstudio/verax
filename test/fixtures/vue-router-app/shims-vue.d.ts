declare module '*.vue' {
  const component: any;
  export default component;
}

declare module 'vue-router' {
  export function createRouter(options: any): any;
  export function createWebHistory(base?: string): any;
  export type Router = any;
  export type RouteRecordRaw = any;
}

