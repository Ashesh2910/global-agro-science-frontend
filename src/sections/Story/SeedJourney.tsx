import { useRef } from "react";

import {
  CanvasRenderer,
  type CanvasRendererHandle,
} from "../../components/canvas/CanvasRenderer";

export default function SeedJourney() {
  const canvasRef = useRef<CanvasRendererHandle>(null);

  return (
    <CanvasRenderer
      ref={canvasRef}
      autoStart={false}
    />
  );
}