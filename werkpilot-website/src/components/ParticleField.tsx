export default function ParticleField() {
  return (
    <div className="particle-field" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${(i * 5.26) % 100}%`,
            top: `${(i * 7.89 + 10) % 100}%`,
            animationDelay: `${(i * 0.7) % 8}s`,
            animationDuration: `${6 + (i % 4) * 2}s`,
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
          }}
        />
      ))}
    </div>
  );
}
