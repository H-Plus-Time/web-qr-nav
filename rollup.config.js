import resolve from "rollup-plugin-node-resolve";

export default {
  entry: "index.js",
  dest: "dist/build.js",
  format: "umd",
  moduleName: "webQR",
  plugins: [
    resolve({
      jsnext: true,
      main: true
    })
  ],
  // external: external
};
