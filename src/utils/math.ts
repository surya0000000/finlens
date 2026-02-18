export const sum = (values: number[]): number =>
  values.reduce((accumulator, value) => accumulator + value, 0);

export const mean = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return sum(values) / values.length;
};

export const standardDeviation = (values: number[]): number => {
  if (values.length <= 1) {
    return 0;
  }

  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
};

export const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

