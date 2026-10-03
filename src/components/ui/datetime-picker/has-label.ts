/** Whether a label renders anything - the `false` of a condition does not. */
const hasLabel = (label: React.ReactNode) =>
  label !== undefined && label !== null && label !== false && label !== "";

export default hasLabel;
