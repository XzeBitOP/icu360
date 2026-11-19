/** First-load mark: an ECG trace that draws itself and closes into a 360° ring.
 *  Painted with inline SVG + CSS (no JS required). A tiny script only skips repeats
 *  and removes the overlay after the animation. */
const TRACE = "M 46.0 100.0 L 48.0 100.0 L 50.0 100.0 L 52.0 100.0 L 54.0 100.0 L 56.0 100.0 L 58.0 100.0 L 60.0 100.0 L 62.0 100.0 L 63.14 98.09 L 64.29 96.01 L 65.43 94.05 L 66.57 92.37 L 67.71 91.08 L 68.86 90.28 L 70.0 90.0 L 71.14 90.28 L 72.29 91.08 L 73.43 92.37 L 74.57 94.05 L 75.71 96.01 L 76.86 98.09 L 78.0 100.0 L 79.6 100.0 L 81.2 100.0 L 82.8 100.0 L 84.4 100.0 L 86.0 100.0 L 87.0 102.75 L 88.0 105.5 L 89.0 108.25 L 90.0 111.0 L 91.33 99.83 L 92.67 88.67 L 94.0 77.5 L 95.33 66.33 L 96.67 55.17 L 98.0 44.0 L 99.43 59.43 L 100.86 74.86 L 102.29 90.29 L 103.71 105.71 L 105.14 121.14 L 106.57 136.57 L 108.0 152.0 L 109.6 141.6 L 111.2 131.2 L 112.8 120.8 L 114.4 110.4 L 116.0 100.0 L 118.0 100.0 L 120.0 100.0 L 122.0 100.0 L 124.0 100.0 L 125.55 97.93 L 127.09 95.77 L 128.64 93.64 L 130.18 91.61 L 131.73 89.74 L 133.27 88.08 L 134.82 86.66 L 136.36 85.51 L 137.91 84.68 L 139.45 84.17 L 141.0 84.0 L 142.55 84.17 L 144.09 84.68 L 145.64 85.51 L 147.18 86.66 L 148.73 88.08 L 150.27 89.74 L 151.82 91.61 L 153.36 93.64 L 154.91 95.77 L 156.45 97.93 L 158 100 L 158.0 100.0 L 163.0 100.0 L 168.0 100.0 L 173.0 100.0 L 178.0 100.0 L 183.0 100.0 L 188.0 100.0 L 193.0 100.0 L 198 100 A 78 78 0 0 1 42 100 A 78 78 0 0 1 198 100";

export function StartupSplash() {
  return (
    <div id="startup-splash" className="startup-splash" aria-hidden="true">
      <div className="startup-mark">
        <svg viewBox="0 0 240 200" width="220" height="183" fill="none" aria-hidden="true">
          <path className="startup-glow" d={TRACE} pathLength="1" strokeLinecap="round" strokeLinejoin="round" />
          <path className="startup-trace" d={TRACE} pathLength="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="startup-word">ICU 360</p>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){if(document.getElementById('startup-splash-skip'))return;setTimeout(function(){if(document.getElementById('startup-splash-skip'))return;var s=document.createElement('style');s.id='startup-splash-skip';s.textContent='.startup-splash{display:none!important}';document.documentElement.appendChild(s);},620);})();`,
        }}
      />
    </div>
  );
}
