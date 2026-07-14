// Camera orbit values returned by model-viewer's getCameraOrbit()
export type CameraOrbit = {
  theta: number;
  phi: number;
  radius: number;
};

// Subset of the <model-viewer> custom element API we use
export type ModelViewerElement = HTMLElement & {
  cameraOrbit?: string;
  autoRotate?: boolean;
  orientation?: string;
  modelIsVisible?: boolean;
  updateComplete?: Promise<unknown>;
  getCameraOrbit?: () => CameraOrbit | null;
  jumpCameraToGoal?: () => void;
};
