import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import onboarding1 from "@/assets/onboarding-1.png";
import onboarding2 from "@/assets/onboarding-2.png";
import onboarding3 from "@/assets/onboarding-3.png";
import onboarding4 from "@/assets/onboarding-4.png";

const slides = [
  {
    image: onboarding1,
    title: "عائلتك، مكان واحد",
    subtitle: "اجمعوا كل أفراد العائلة في تطبيق واحد يسهّل حياتكم اليومية",
    bg: "from-[hsl(25,60%,95%)] to-[hsl(25,40%,88%)]",
  },
  {
    image: onboarding2,
    title: "نظّموا حياتكم سوا",
    subtitle: "مهام، تسوّق، مواعيد، وميزانية... كل شيء بمتناول يدكم",
    bg: "from-[hsl(150,30%,93%)] to-[hsl(150,25%,86%)]",
  },
  {
    image: onboarding3,
    title: "لحظاتكم محفوظة",
    subtitle: "احفظوا ذكرياتكم وصوركم في ألبومات مشتركة للعائلة",
    bg: "from-[hsl(35,55%,94%)] to-[hsl(35,40%,87%)]",
  },
  {
    image: onboarding4,
    title: "ابدأوا رحلتكم",
    subtitle: "سجّلوا الآن وابدأوا بتنظيم حياتكم العائلية بكل سهولة",
    bg: "from-[hsl(210,30%,94%)] to-[hsl(210,25%,87%)]",
  },
];

const AUTO_ADVANCE_MS = 5000;

const GetStarted = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const isLast = current === slides.length - 1;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isLast) {
      timerRef.current = setTimeout(() => {
        setDirection(1);
        setCurrent((p) => Math.min(p + 1, slides.length - 1));
      }, AUTO_ADVANCE_MS);
    }
  }, [isLast]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, resetTimer]);

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > current ? 1 : -1);
      setCurrent(index);
    },
    [current]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const threshold = 50;
      if (info.offset.x < -threshold && current < slides.length - 1) {
        goTo(current + 1);
      } else if (info.offset.x > threshold && current > 0) {
        goTo(current - 1);
      }
    },
    [current, goTo]
  );

  const handleGetStarted = () => {
    localStorage.setItem("onboarding_seen", "true");
    navigate("/auth", { replace: true });
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_seen", "true");
    navigate("/auth", { replace: true });
  };

  const slide = slides[current];

  const variants = {
    enter: (d: number) => ({
      x: d > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.92,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (d: number) => ({
      x: d > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.92,
    }),
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-b ${slide.bg} flex flex-col items-center justify-between overflow-hidden relative`}
      style={{ transition: "background 0.6s ease" }}
    >
      {/* Story-style progress bars */}
      <div className="w-full px-4 pt-4 flex gap-1.5 z-20">
        {slides.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden cursor-pointer"
            onClick={() => goTo(i)}
          >
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{
                width: i < current ? "100%" : i === current ? "100%" : "0%",
              }}
              transition={{
                duration: i === current ? AUTO_ADVANCE_MS / 1000 : 0.3,
                ease: i === current ? "linear" : "easeOut",
              }}
              key={i === current ? `active-${current}` : `done-${i}`}
            />
          </div>
        ))}
      </div>

      {/* Skip button */}
      {!isLast && (
        <button
          onClick={handleSkip}
          className="absolute top-10 left-5 text-sm text-muted-foreground/70 z-20 flex items-center gap-1 active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-4 w-4" />
          تخطي
        </button>
      )}

      {/* Main swipeable content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6 relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.45,
              ease: [0.16, 1, 0.3, 1],
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="flex flex-col items-center text-center w-full cursor-grab active:cursor-grabbing select-none"
          >
            {/* Floating image with subtle bounce */}
            <motion.img
              src={slide.image}
              alt={slide.title}
              className="w-64 h-64 sm:w-72 sm:h-72 object-contain pointer-events-none"
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Title */}
            <motion.h1
              className="text-2xl sm:text-3xl font-bold text-foreground mt-8 mb-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {slide.title}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="text-base text-muted-foreground leading-relaxed max-w-xs"
              style={{ textWrap: "balance" }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {slide.subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom area */}
      <div className="w-full px-6 pb-10 flex flex-col items-center gap-5">
        {/* Dot indicators */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full bg-primary cursor-pointer"
              animate={{
                width: i === current ? 24 : 8,
                height: 8,
                opacity: i === current ? 1 : 0.3,
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        {/* Action button */}
        {isLast ? (
          <motion.button
            onClick={handleGetStarted}
            className="w-full max-w-xs h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg active:scale-[0.97] transition-transform"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            يلّا نبدأ 🚀
          </motion.button>
        ) : (
          <motion.button
            onClick={() => goTo(current + 1)}
            className="w-full max-w-xs h-14 rounded-2xl bg-primary/10 text-primary font-semibold text-lg active:scale-[0.97] transition-transform"
            whileTap={{ scale: 0.97 }}
          >
            التالي
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default GetStarted;
