import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;
const toRad = (deg: number) => (deg * Math.PI) / 180;

const calculateQiblaAngle = (lat: number, lng: number): number => {
  const phiK = toRad(KAABA_LAT);
  const lambdaK = toRad(KAABA_LNG);
  const phi = toRad(lat);
  const lambda = toRad(lng);
  const num = Math.sin(lambdaK - lambda);
  const den = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda);
  let qibla = (Math.atan2(num, den) * 180) / Math.PI;
  return (qibla + 360) % 360;
};

const KaabaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="6" width="16" height="14" rx="1" fill="white" opacity="0.85" />
    <rect x="6" y="4" width="12" height="4" rx="0.5" fill="white" opacity="0.6" />
  </svg>
);

const QiblaCompass = () => {
  const [qiblaAngle, setQiblaAngle] = useState<number>(253);
  const [heading, setHeading] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setQiblaAngle(calculateQiblaAngle(pos.coords.latitude, pos.coords.longitude)),
      () => {}
    );
  }, []);

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const compassHeading = (e as any).webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null);
    if (compassHeading != null) {
      setHeading(compassHeading);
      setHasPermission(true);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      try {
        const perm = await (DeviceOrientationEvent as any).requestPermission();
        if (perm === "granted") {
          window.addEventListener("deviceorientation", handleOrientation, true);
          setHasPermission(true);
        }
      } catch {}
    } else {
      window.addEventListener("deviceorientation", handleOrientation, true);
      setHasPermission(true);
    }
  }, [handleOrientation]);

  useEffect(() => {
    if (typeof (DeviceOrientationEvent as any).requestPermission !== "function") {
      window.addEventListener("deviceorientation", handleOrientation, true);
      const timer = setTimeout(() => {
        if (hasPermission === null) setHasPermission(false);
      }, 2000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("deviceorientation", handleOrientation, true);
      };
    }
  }, [handleOrientation, hasPermission]);

  const needleRotation = (qiblaAngle - heading + 360) % 360;
  const isAligned = Math.abs(needleRotation) < 15 || Math.abs(needleRotation - 360) < 15;

  const arcR = 28;
  const cx = 35;
  const cy = 36;

  return (
    <div
      className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex flex-col items-center border border-white/10 cursor-pointer"
      onClick={() => (!hasPermission ? requestPermission() : null)}
    >
      <p className="text-[10px] font-bold text-white/60 mb-1">القبلة</p>
      <svg width="70" height="50" viewBox="0 0 70 50" className="overflow-visible">
        {/* Arc track */}
        <path
          d={`M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 1 1 ${cx + arcR} ${cy}`}
          fill="none"
          stroke="white"
          strokeOpacity="0.2"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Kaaba at top */}
        <foreignObject x={cx - 8} y={cy - arcR - 10} width="16" height="16">
          <div className="flex items-center justify-center w-full h-full">
            <KaabaIcon />
          </div>
        </foreignObject>
        {/* Moving dot */}
        <motion.circle
          r="4.5"
          fill={isAligned ? "hsl(48, 96%, 53%)" : "hsl(48, 80%, 70%)"}
          animate={{
            cx: cx + arcR * Math.sin(toRad(needleRotation)),
            cy: cy - arcR * Math.cos(toRad(needleRotation)),
          }}
          transition={{ type: "spring", stiffness: 80, damping: 15 }}
        />
        {isAligned && (
          <motion.circle
            r="7"
            fill="none"
            stroke="hsl(48, 96%, 53%)"
            strokeWidth="1.5"
            animate={{
              cx: cx + arcR * Math.sin(toRad(needleRotation)),
              cy: cy - arcR * Math.cos(toRad(needleRotation)),
              opacity: [0.8, 0],
              scale: [1, 1.8],
            }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
      </svg>
    </div>
  );
};

export default QiblaCompass;
