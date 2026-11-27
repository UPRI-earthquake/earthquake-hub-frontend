declare global {
  interface Dimensions {
    width: number;
    height: number;
  }

  interface PointLT {
    left: number;
    top: number;
  }

  interface Coords {
    longitude: number;
    latitude: number;
  }
}

export {};