const PATHS = {
  add: ['M12 5v14', 'M5 12h14'],
  alignBottom: ['M5 19h14', 'M8 5v10h8V5'],
  alignCenterH: ['M12 4v16', 'M7 8h10v3H7z', 'M5 14h14v3H5z'],
  alignCenterV: ['M4 12h16', 'M8 7h3v10H8z', 'M14 5h3v14h-3z'],
  alignLeft: ['M5 4v16', 'M8 7h10v3H8z', 'M8 14h7v3H8z'],
  alignRight: ['M19 4v16', 'M6 7h10v3H6z', 'M9 14h7v3H9z'],
  alignTop: ['M5 5h14', 'M8 9h8v10H8z'],
  delete: ['M6 7h12', 'M9 7V5h6v2', 'M8 9l1 10h6l1-10'],
  distributeH: ['M5 5v14', 'M19 5v14', 'M8 9h8v6H8z'],
  distributeV: ['M5 5h14', 'M5 19h14', 'M9 8h6v8H9z'],
  drag: ['M9 6h.01', 'M15 6h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18h.01', 'M15 18h.01'],
  duplicate: ['M8 8h10v10H8z', 'M5 5h10v10'],
  eye: ['M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z', 'M10 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0'],
  eyeOff: ['M4 4l16 16', 'M7 7c-2.5 1.4-4 5-4 5s3.5 5 9 5c1.3 0 2.5-.3 3.5-.7', 'M10.6 10.6a2 2 0 0 0 2.8 2.8', 'M9.9 5.3c.7-.2 1.4-.3 2.1-.3 5.5 0 9 5 9 5s-.9 1.3-2.4 2.6'],
  fit: ['M6 9V6h3', 'M18 9V6h-3', 'M6 15v3h3', 'M18 15v3h-3'],
  group: ['M5 7h6v6H5z', 'M13 11h6v6h-6z'],
  image: ['M5 6h14v12H5z', 'M8 14l3-3 2 2 2-3 3 4', 'M8.5 9.5h.01'],
  layerDown: ['M7 8l5 5 5-5', 'M7 15h10'],
  layerUp: ['M7 16l5-5 5 5', 'M7 9h10'],
  lock: ['M7 11h10v8H7z', 'M9 11V8a3 3 0 0 1 6 0v3'],
  more: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
  motion: ['M5 16c4-8 10 0 14-8', 'M15 8h4v4'],
  preview: ['M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z', 'M10 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0'],
  redo: ['M8 7h7a4 4 0 0 1 0 8H6', 'M12 4l4 3-4 3'],
  save: ['M6 4h10l2 2v14H6z', 'M8 4v6h8', 'M9 17h6'],
  shape: ['M6 7h12v10H6z'],
  style: ['M5 5h7l7 7-7 7-7-7z', 'M9 9h.01'],
  text: ['M5 6h14', 'M12 6v12', 'M9 18h6'],
  unlock: ['M7 11h10v8H7z', 'M10 11V8a3 3 0 0 1 5.6-1.5'],
  undo: ['M16 7H9a4 4 0 0 0 0 8h9', 'M12 4L8 7l4 3'],
  zoomIn: ['M10 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M15 15l4 4', 'M10 8v4', 'M8 10h4'],
  zoomOut: ['M10 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M15 15l4 4', 'M8 10h4'],
} as const;

type EditorIconName = keyof typeof PATHS;

type EditorIconProps = {
  name: EditorIconName | string;
  className?: string;
  size?: number;
};

export function EditorIcon({ name, className = '', size = 16 }: EditorIconProps) {
  const paths = PATHS[name as EditorIconName] || PATHS.shape;
  return (
    <svg
      className={`editor-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d, index) => (
        <path key={`${name}-${index}`} d={d} />
      ))}
    </svg>
  );
}
