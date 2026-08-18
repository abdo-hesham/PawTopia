// Conservative SVG optimisation: geometry is rounded to two decimals and metadata is
// dropped, but viewBox and readable ids stay so the markup and CSS that reference them
// keep working.
export default {
  multipass: true,
  floatPrecision: 2,
  plugins: [
    { name: "preset-default", params: { overrides: { removeViewBox: false, cleanupIds: { minify: false } } } },
    "removeDimensions",
  ],
};
