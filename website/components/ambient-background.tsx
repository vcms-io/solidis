'use client';

import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform float time;
  uniform vec2 resolution;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float aspect = resolution.x / resolution.y;

    float t = time * 0.35;
    float uvx = uv.x * aspect;

    // 4 blobs spread across the full screen with wide orbits
    float blob1 = exp(-2.0 * length(vec2(uvx, uv.y) - vec2(aspect * (0.2 + sin(t * 0.23) * 0.25), 0.25 + cos(t * 0.19) * 0.25)));
    float blob2 = exp(-2.0 * length(vec2(uvx, uv.y) - vec2(aspect * (0.8 + cos(t * 0.27) * 0.2), 0.2 + sin(t * 0.22) * 0.3)));
    float blob3 = exp(-2.2 * length(vec2(uvx, uv.y) - vec2(aspect * (0.25 + cos(t * 0.2) * 0.2), 0.75 + sin(t * 0.25) * 0.2)));
    float blob4 = exp(-2.2 * length(vec2(uvx, uv.y) - vec2(aspect * (0.75 + sin(t * 0.18) * 0.22), 0.8 + cos(t * 0.21) * 0.18)));

    vec3 amber = vec3(0.78, 0.48, 0.22);
    vec3 gold = vec3(0.76, 0.52, 0.26);
    vec3 copper = vec3(0.72, 0.42, 0.20);
    vec3 warm = vec3(0.75, 0.50, 0.24);

    vec3 color = amber * blob1 + gold * blob2 + copper * blob3 + warm * blob4;

    float intensity = blob1 + blob2 + blob3 + blob4;
    float alpha = intensity * 0.18;

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export function AmbientBackground() {
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const animationReference = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasReference.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!gl) {
      return;
    }

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) {
      return;
    }

    const activate = gl.useProgram.bind(gl);
    activate(program);

    const positionAttribute = gl.getAttribLocation(program, 'position');
    const timeUniform = gl.getUniformLocation(program, 'time');
    const resolutionUniform = gl.getUniformLocation(program, 'resolution');

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(positionAttribute);
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    function resize() {
      if (!canvas || !gl) {
        return;
      }
      const scale = 0.5;
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.floor(width * scale);
      canvas.height = Math.floor(height * scale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    resize();
    window.addEventListener('resize', resize);

    const startTime = performance.now();

    function draw() {
      if (!gl || !canvas) {
        return;
      }

      const elapsed = (performance.now() - startTime) / 1000;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(timeUniform, elapsed);
      gl.uniform2f(resolutionUniform, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationReference.current = requestAnimationFrame(draw);
    }

    animationReference.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationReference.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <canvas ref={canvasReference} className="block" />
    </div>
  );
}
