declare module 'uzip' {
  const UZIP: {
    parse: (buffer: ArrayBuffer) => Record<string, Uint8Array>;
  };

  export default UZIP;
}
