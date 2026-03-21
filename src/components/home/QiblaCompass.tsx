import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

// Kaaba coordinates
const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

const calculateQiblaAngle = (lat: number, lng: number): number => {
  const phiK = toRad(KAABA_LAT);
  const lambdaK = toRad(KAABA_LNG);
  const phi = toRad(lat);
  const lambda = toRad(lng);
  const num = Math.sin(lambdaK - lambda);
  const den = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda);
  let qibla = toDeg(Math.atan2(num, den));
  return (qibla + 360) % 360;
};

const KaabaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="6" width="16" height="14" rx="1" fill="hsl(var(--foreground))" opacity="0.85" />
    <rect x="6" y="4" width="12" height="4" rx="0.5" fill="hsl(var(--foreground))" opacity="0.6" />
    <line x1="12" y1="10" x2="12" y2="18" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.7" />
    <circle cx="12" cy="13" r="2" fill="hsl(var(--primary))" opacity="0.5" />
  </svg>
);

const QiblaCompass = () => {
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setQiblaAngle(calculateQiblaAngle(loc.lat, loc.lng));
      },
      () => setQiblaAngle(253) // Default for Riyadh area
    );
  }, []);

  // Device orientation
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    // iOS uses webkitCompassHeading, Android uses alpha
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
        } else {
          setHasPermission(false);
        }
      } catch {
        setHasPermission(false);
      }
    } else {
      window.addEventListener("deviceorientation", handleOrientation, true);
      setHasPermission(true);
    }
  }, [handleOrientation]);

  useEffect(() => {
    // Try to listen directly (Android)
    if (typeof (DeviceOrientationEvent as any).requestPermission !== "function") {
      window.addEventListener("deviceorientation", handleOrientation, true);
      // Check if we get data after a timeout
      const timer = setTimeout(() => {
        if (hasPermission === null) setHasPermission(false);
      }, 2000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("deviceorientation", handleOrientation, true);
      };
    }
  }, [handleOrientation, hasPermission]);

  const qAngle = qiblaAngle ?? 253;
  // Needle rotation: difference between qibla and current heading
  const needleRotation = (qAngle - heading + 360) % 360;
  const isAligned = Math.abs(needleRotation) < 15 || Math.abs(needleRotation - 360) < 15;

  // Arc path for the semi-circle guide
  const arcRadius = 32;
  const centerX = 40;
  const centerY = 42;

  return (
    <div
      className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-3 border border-white/10 cursor-pointer"
      onClick={() => hasPermission === null || hasPermission === false ? requestPermission() : null}
    >
      {/* Compass visual */}
      <div className="w-10 h-10 relative flex items-center justify-center shrink-0">
        <svg width="40" height="40" viewBox="0 0 80 84" className="overflow-visible">
          {/* Arc track */}
          <path
            d={`M ${centerX - arcRadius} ${centerY} A ${arcRadius} ${arcRadius} 0 1 1 ${centerX + arcRadius} ${centerY}`}
            fill="none"
            stroke="white"
            strokeOpacity="0.2"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Kaaba at top center of arc */}
          <foreignObject x={centerX - 10} y={centerY - arcRadius - 12} width="20" height="20">
            <div className="flex items-center justify-center w-full h-full">
              <KaabaIcon />
            </div>
          </foreignObject>
          {/* Moving indicator dot */}
          <motion.circle
            cx={centerX + arcRadius * Math.sin(toRad(needleRotation))}
            cy={centerY - arcRadius * Math.cos(toRad(needleRotation))}
            r="5"
            fill={isAligned ? "hsl(48, 96%, 53%)" : "hsl(48, 80%, 70%)"}
            animate={{
              cx: centerX + arcRadius * Math.sin(toRad(needleRotation)),
              cy: centerY - arcRadius * Math.cos(toRad(needleRotation)),
              fill: isAligned ? "hsl(48, 96%, 53%)" : "hsl(48, 80%, 70%)",
            }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
          />
          {isAligned && (
            <motion.circle
              cx={centerX + arcRadius * Math.sin(toRad(needleRotation))}
              cy={centerY - arcRadius * Math.cos(toRad(needleRotation))}
              r="8"
              fill="none"
              stroke="hsl(48, 96%, 53%)"
              strokeWidth="1.5"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0.8, 0], scale: [1, 1.8] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </svg>
      </div>
      <div>
        <p className="text-[10px] font-bold text-white/60">القبلة</p>
        {hasPermission === false || hasPermission === null ? (
          <p className="text-[11px] font-semibold text-white/80">اضغط للتفعيل</p>
        ) : isAligned ? (
          <p className="text-sm font-bold text-yellow-200">✓ اتجاه القبلة</p>
        ) : (
          <p className="text-sm font-bold text-white/90">حرّك الجوال</p>
        )}
      </div>
    </div>
  );
};

export default QiblaCompass;
