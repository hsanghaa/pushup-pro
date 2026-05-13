import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export type { PoseLandmarker };

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// Use the exact installed package version for the WASM runtime
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

let _landmarker: PoseLandmarker | null = null;
let _promise: Promise<PoseLandmarker> | null = null;

export async function loadPoseLandmarker(): Promise<PoseLandmarker> {
  if (_landmarker) return _landmarker;
  if (_promise) return _promise;

  _promise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    _landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    return _landmarker;
  })();

  return _promise;
}
