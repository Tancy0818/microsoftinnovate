export const time = (value: string | number | Date) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
export const duration = (minutes: number) =>
  minutes >= 1440
    ? `${(minutes / 1440).toFixed(1)} d`
    : minutes >= 60
      ? `${(minutes / 60).toFixed(1)} h`
      : `${Math.round(minutes)} min`;
export const triageLabels = {
  "Not assessed": "Pending assessment",
  Red: "Immediate",
  Orange: "Very urgent",
  Yellow: "Urgent",
  Green: "Less urgent",
  Blue: "Non-urgent",
};
export const triageColors = {
  "Not assessed": "#8593a6",
  Red: "#e6565a",
  Orange: "#f09644",
  Yellow: "#edc24d",
  Green: "#4aa78a",
  Blue: "#548bd6",
};
