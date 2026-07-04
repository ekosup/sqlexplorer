/// <reference types="vite/client" />

declare module '*?worker' {
  const workerCtor: new () => Worker;
  export default workerCtor;
}
